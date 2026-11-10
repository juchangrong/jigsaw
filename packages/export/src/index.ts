/**
 * Image encoding. PNG is encoded in pure TypeScript (zlib via the standard
 * `CompressionStream`, available in browsers and Node ≥ 18) so exports are
 * byte-exact with the rendered pixels. WebP uses the browser's canvas encoder.
 */

export type ExportFormat = "png" | "webp";

export interface RgbaImage {
  width: number;
  height: number;
  /** straight (non-premultiplied) sRGB RGBA, 8 bit */
  data: Uint8ClampedArray;
}

/** Convert premultiplied RGBA to straight alpha (in place copy). */
export function unpremultiply(src: Uint8ClampedArray | Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3]!;
    out[i + 3] = a;
    if (a === 0) continue;
    const k = 255 / a;
    out[i] = src[i]! * k + 0.5;
    out[i + 1] = src[i + 1]! * k + 0.5;
    out[i + 2] = src[i + 2]! * k + 0.5;
  }
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function chunk(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + payload.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, payload.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  dv.setUint32(8 + payload.length, crc32(out, 4, 8 + payload.length));
  return out;
}

/** Encode straight-alpha RGBA as a PNG (with an sRGB chunk). */
export async function encodePNG(img: RgbaImage): Promise<Uint8Array> {
  const { width, height, data } = img;
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("sRGB", new Uint8Array([0])),
    chunk("IDAT", await deflate(raw)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export async function pngBlob(img: RgbaImage): Promise<Blob> {
  return new Blob([(await encodePNG(img))], { type: "image/png" });
}

/** Encode through a canvas (browser only). Used for WebP. */
export async function canvasBlob(img: RgbaImage, format: ExportFormat, quality = 0.95): Promise<Blob> {
  if (typeof OffscreenCanvas === "undefined" && typeof document === "undefined") {
    throw new Error(`${format} export needs a browser canvas`);
  }
  const imageData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  const type = `image/${format}`;
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(img.width, img.height);
    c.getContext("2d")!.putImageData(imageData, 0, 0);
    return c.convertToBlob({ type, quality });
  }
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d")!.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), type, quality),
  );
}

export async function encodeImage(img: RgbaImage, format: ExportFormat, quality?: number): Promise<Blob> {
  if (format === "png") return pngBlob(img);
  const blob = await canvasBlob(img, format, quality);
  if (blob.type !== `image/${format}`) throw new Error(`This browser cannot encode ${format}`);
  return blob;
}

/** Trigger a download in the browser. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
