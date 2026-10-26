// The Emscripten glue behind wasm-webp. Its package entry cannot load in Node, so Node code imports the glue.
declare module 'wasm-webp/dist/esm/webp-wasm.js' {
  interface WebpGlue {
    decodeRGBA(data: Uint8Array): { data: Uint8Array; width: number; height: number } | null;
    encode(
      data: Uint8Array, width: number, height: number, hasAlpha: boolean, config: { lossless: number; quality: number },
    ): Uint8Array | null;
  }
  const factory: () => Promise<WebpGlue>;
  export default factory;
}
