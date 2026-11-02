export function readImageAspect(src: string): Promise<number>;
export function readImageAspect(src: string, fallback: null): Promise<number | null>;
/** An image's width over its height, read by loading it. A picture that never loads reads as `fallback`, by default 16:9. */
export function readImageAspect(src: string, fallback: number | null = 16 / 9): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const failed = () => resolve(fallback);
    img.onload = () => (img.naturalWidth && img.naturalHeight ? resolve(img.naturalWidth / img.naturalHeight) : failed());
    img.onerror = failed;
    img.src = src;
  });
}
