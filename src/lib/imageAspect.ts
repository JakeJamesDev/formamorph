/** An image's width over its height, read by loading it. A picture that never loads reads as 16:9. */
export function readImageAspect(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    const fallback = () => resolve(16 / 9);
    img.onload = () => (img.naturalWidth && img.naturalHeight ? resolve(img.naturalWidth / img.naturalHeight) : fallback());
    img.onerror = fallback;
    img.src = src;
  });
}
