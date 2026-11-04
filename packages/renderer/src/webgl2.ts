import { packPieceUniforms, type RenderPlan, type SdfField } from "@jigsaw/core";
import fragmentSource from "../shaders/puzzle.frag.glsl?raw";
import { LruMap, SerialQueue, type RenderBackend } from "./backend";

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

/** WebGL2 fallback: same shader math as WGSL, one shared context. */
export class WebGl2Backend implements RenderBackend {
  readonly kind = "webgl2" as const;
  private queue = new SerialQueue();
  private textures: LruMap<WebGLTexture>;
  private ids = new WeakMap<SdfField, string>();
  private nextId = 0;
  private live = 0;
  private loc: {
    u: WebGLUniformLocation;
    tex: WebGLUniformLocation;
    height: WebGLUniformLocation;
    mode: WebGLUniformLocation;
  };

  private constructor(
    private canvas: OffscreenCanvas | HTMLCanvasElement,
    private gl: WebGL2RenderingContext,
    private program: WebGLProgram,
  ) {
    this.textures = new LruMap<WebGLTexture>(96, (t) => {
      gl.deleteTexture(t);
      this.live--;
    });
    const get = (n: string) => {
      const l = gl.getUniformLocation(program, n);
      if (!l) throw new Error(`missing uniform ${n}`);
      return l;
    };
    this.loc = { u: get("u"), tex: get("sdfTex"), height: get("uHeight"), mode: get("uMode") };
  }

  static async create(): Promise<WebGl2Backend> {
    const canvas: OffscreenCanvas | HTMLCanvasElement =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(1, 1)
        : typeof document !== "undefined"
          ? document.createElement("canvas")
          : (() => {
              throw new Error("No canvas available");
            })();
    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      alpha: true,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error("WebGL2 is not available");
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`GLSL: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`GLSL link: ${gl.getProgramInfoLog(program)}`);
    return new WebGl2Backend(canvas, gl, program);
  }

  get liveTextures() {
    return this.live;
  }

  private texture(sdf: SdfField): WebGLTexture {
    let id = this.ids.get(sdf);
    if (!id) this.ids.set(sdf, (id = `sdf${this.nextId++}`));
    const hit = this.textures.get(id);
    if (hit) return hit;
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, sdf.width, sdf.height, 0, gl.RED, gl.FLOAT, sdf.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.live++;
    this.textures.set(id, t);
    return t;
  }

  render(plan: RenderPlan): Promise<Uint8ClampedArray> {
    return this.queue.run(async () => {
      const gl = this.gl;
      const { width: w, height: h } = plan;
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      const bg = plan.background;
      gl.clearColor(bg ? bg[0] : 0, bg ? bg[1] : 0, bg ? bg[2] : 0, bg ? 1 : 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.program);
      gl.uniform1f(this.loc.height, h);
      gl.uniform1i(this.loc.tex, 0);
      gl.activeTexture(gl.TEXTURE0);
      const packed = plan.pieces.map((p) => packPieceUniforms(plan, p));
      const draw = (mode: number) =>
        plan.pieces.forEach((p, i) => {
          gl.bindTexture(gl.TEXTURE_2D, this.texture(p.sdf));
          gl.uniform4fv(this.loc.u, packed[i]!);
          gl.uniform1i(this.loc.mode, mode);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        });
      if (plan.shadowEnabled) draw(0);
      draw(1);
      const raw = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      // flip rows: GL reads bottom-up
      const out = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) out.set(raw.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      return out;
    });
  }

  dispose() {
    this.textures.clear();
    this.gl.deleteProgram(this.program);
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
