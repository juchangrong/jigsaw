import { packPieceUniforms, UNIFORM_VEC4S, type RenderPlan, type SdfField } from "@jigsaw/core";
import shaderSource from "../shaders/puzzle.wgsl?raw";
import { LruMap, SerialQueue, type RenderBackend } from "./backend";

const UNIFORM_STRIDE = 512; // ≥ UNIFORM_VEC4S·16 and a multiple of 256

/**
 * WebGPU backend. One device, two pipelines (shadow, surface) and a cache of
 * SDF textures shared by every icon. Each render draws all shadows, then all
 * surfaces, with premultiplied "over" blending into an rgba8unorm target, and
 * reads the pixels back so preview and export are the same bytes.
 */
export class WebGpuBackend implements RenderBackend {
  readonly kind = "webgpu" as const;
  private queue = new SerialQueue();
  private textures: LruMap<GPUTexture>;
  private textureIds = new WeakMap<SdfField, string>();
  private nextId = 0;
  private uniform: GPUBuffer | null = null;
  private uniformCapacity = 0;
  private target: GPUTexture | null = null;
  private readback: GPUBuffer | null = null;
  private live = 0;
  private disposed = false;

  private constructor(
    private device: GPUDevice,
    private shadowPipeline: GPURenderPipeline,
    private surfacePipeline: GPURenderPipeline,
    private layout: GPUBindGroupLayout,
  ) {
    this.textures = new LruMap<GPUTexture>(96, (t) => {
      t.destroy();
      this.live--;
    });
  }

  static async create(): Promise<WebGpuBackend> {
    if (typeof navigator === "undefined" || !("gpu" in navigator) || !navigator.gpu) {
      throw new Error("WebGPU is not available");
    }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) throw new Error("No WebGPU adapter");
    const device = await adapter.requestDevice();
    if (!device) throw new Error("No WebGPU device");
    const module = device.createShaderModule({ code: shaderSource });
    const info = await module.getCompilationInfo?.();
    const errors = info?.messages.filter((m) => m.type === "error") ?? [];
    if (errors.length) throw new Error(`WGSL: ${errors.map((e) => e.message).join("; ")}`);

    const layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform", hasDynamicOffset: true } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "unfilterable-float" } },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const blend: GPUBlendState = {
      color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    };
    const make = (entryPoint: string) =>
      device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: { module, entryPoint: "vs" },
        fragment: { module, entryPoint, targets: [{ format: "rgba8unorm", blend }] },
        primitive: { topology: "triangle-list" },
      });
    return new WebGpuBackend(device, make("fsShadow"), make("fsSurface"), layout);
  }

  get liveTextures() {
    return this.live;
  }

  private sdfTexture(sdf: SdfField): GPUTexture {
    let id = this.textureIds.get(sdf);
    if (!id) {
      id = `sdf${this.nextId++}`;
      this.textureIds.set(sdf, id);
    }
    const hit = this.textures.get(id);
    if (hit) return hit;
    const tex = this.device.createTexture({
      size: [sdf.width, sdf.height],
      format: "r32float",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.live++;
    this.device.queue.writeTexture(
      { texture: tex },
      sdf.data as Float32Array<ArrayBuffer>,
      { bytesPerRow: sdf.width * 4 },
      [sdf.width, sdf.height],
    );
    this.textures.set(id, tex);
    return tex;
  }

  private ensureTarget(w: number, h: number) {
    if (!this.target || this.target.width !== w || this.target.height !== h) {
      if (this.target) {
        this.target.destroy();
        this.live--;
      }
      this.readback?.destroy();
      this.target = this.device.createTexture({
        size: [w, h],
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
      this.live++;
      const bytesPerRow = Math.ceil((w * 4) / 256) * 256;
      this.readback = this.device.createBuffer({
        size: bytesPerRow * h,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
    }
  }

  private ensureUniform(count: number) {
    if (this.uniformCapacity >= count) return;
    this.uniform?.destroy();
    this.uniformCapacity = Math.max(count, 16);
    this.uniform = this.device.createBuffer({
      size: this.uniformCapacity * UNIFORM_STRIDE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  render(plan: RenderPlan): Promise<Uint8ClampedArray> {
    return this.queue.run(() => this.renderNow(plan));
  }

  private async renderNow(plan: RenderPlan): Promise<Uint8ClampedArray> {
    if (this.disposed) throw new Error("Renderer disposed");
    const { width: w, height: h } = plan;
    const d = this.device;
    this.ensureTarget(w, h);
    this.ensureUniform(plan.pieces.length);

    const data = new Float32Array((UNIFORM_STRIDE / 4) * plan.pieces.length);
    plan.pieces.forEach((p, i) => {
      data.set(packPieceUniforms(plan, p, new Float32Array(UNIFORM_VEC4S * 4)), (i * UNIFORM_STRIDE) / 4);
    });
    d.queue.writeBuffer(this.uniform!, 0, data);

    const groups = plan.pieces.map((p) =>
      d.createBindGroup({
        layout: this.layout,
        entries: [
          { binding: 0, resource: { buffer: this.uniform!, size: UNIFORM_VEC4S * 16 } },
          { binding: 1, resource: this.sdfTexture(p.sdf).createView() },
        ],
      }),
    );

    const bg = plan.background;
    const enc = d.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [
        {
          view: this.target!.createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: bg ? { r: bg[0], g: bg[1], b: bg[2], a: 1 } : { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });
    if (plan.shadowEnabled) {
      pass.setPipeline(this.shadowPipeline);
      groups.forEach((g, i) => {
        pass.setBindGroup(0, g, [i * UNIFORM_STRIDE]);
        pass.draw(3);
      });
    }
    pass.setPipeline(this.surfacePipeline);
    groups.forEach((g, i) => {
      pass.setBindGroup(0, g, [i * UNIFORM_STRIDE]);
      pass.draw(3);
    });
    pass.end();
    const bytesPerRow = Math.ceil((w * 4) / 256) * 256;
    enc.copyTextureToBuffer({ texture: this.target! }, { buffer: this.readback!, bytesPerRow }, [w, h]);
    d.queue.submit([enc.finish()]);

    await this.readback!.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(this.readback!.getMappedRange());
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) out.set(mapped.subarray(y * bytesPerRow, y * bytesPerRow + w * 4), y * w * 4);
    this.readback!.unmap();
    return out;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.textures.clear();
    this.target?.destroy();
    this.readback?.destroy();
    this.uniform?.destroy();
    this.target = null;
    this.live = 0;
    this.device.destroy();
  }
}
