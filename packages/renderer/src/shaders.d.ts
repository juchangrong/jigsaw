// Bun loads these as strings through the `with { type: "text" }` import attribute
declare module "*.wgsl" {
  const source: string;
  export default source;
}
declare module "*.glsl" {
  const source: string;
  export default source;
}
