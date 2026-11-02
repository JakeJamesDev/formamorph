const MIN_ALPHA = 10;

/** Per-channel median of the opaque pixels in RGBA data, each channel in 0..1. Null when no pixel is opaque. */
export function medianOpaqueRGB(data: ArrayLike<number>): [number, number, number] | null {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < MIN_ALPHA) continue;
    hist[0][data[i]]++; hist[1][data[i + 1]]++; hist[2][data[i + 2]]++;
    n++;
  }
  if (!n) return null;
  const half = Math.ceil(n / 2);
  const median = (h: Uint32Array) => {
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += h[v];
      if (seen >= half) return v / 255;
    }
    return 1;
  };
  return [median(hist[0]), median(hist[1]), median(hist[2])];
}
