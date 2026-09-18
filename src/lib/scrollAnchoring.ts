/**
 * Whether the engine anchors scroll natively (CSS `overflow-anchor`). WebKit through Safari 26, and so every
 * iOS browser, does not (MDN browser-compat-data; caniuse `css-overflow-anchor`).
 */
export function hasNativeScrollAnchoring(css: { supports?: (property: string, value: string) => boolean } | undefined = globalThis.CSS): boolean {
  return !!css?.supports?.('overflow-anchor', 'auto');
}
