import { describe, expect, it } from "vitest";
import { blendColor, mixOklab } from "./oklab";

describe("mixOklab", () => {
  it("returns each end at 0 and 1", () => {
    expect(mixOklab("#f0d0c0", "#303040", 0)).toBe("#f0d0c0");
    expect(mixOklab("#f0d0c0", "#303040", 1)).toBe("#303040");
  });
  it("clamps t to [0, 1]", () => {
    expect(mixOklab("#f0d0c0", "#303040", 3)).toBe("#303040");
    expect(mixOklab("#f0d0c0", "#303040", -1)).toBe("#f0d0c0");
  });
  it("keeps a red-to-green midpoint brighter than the sRGB average", () => {
    // sRGB averaging gives #808000, a dark olive; OKLab keeps the perceived lightness of the ends.
    const mid = mixOklab("#ff0000", "#00ff00", 0.5);
    const [r, g] = [parseInt(mid.slice(1, 3), 16), parseInt(mid.slice(3, 5), 16)];
    expect(r).toBeGreaterThan(0xa0);
    expect(g).toBeGreaterThan(0xa0);
  });
  it("leaves the start for an unreadable target", () => {
    expect(mixOklab("#123456", "red", 0.5)).toBe("#123456");
  });
});

describe("blendColor", () => {
  it("applies steps in order", () => {
    const steps = [{ target: "#ff0000", t: 1 }, { target: "#0000ff", t: 1 }];
    expect(blendColor("#ffffff", steps)).toBe("#0000ff");
    expect(blendColor("#ffffff", [...steps].reverse())).toBe("#ff0000");
  });
  it("keeps the start with no steps", () => {
    expect(blendColor("#abcdef", [])).toBe("#abcdef");
  });
});
