import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

interface Passage { id: string; text: string; clusters: number[][][]; [key: string]: unknown }
interface Segment { s: number; e: number; text: string; mentions: [number, number, number][] }
const E = createRequire(import.meta.url)("./seedEditor.cjs") as {
  validate: (p: Passage) => string[];
  parseFile: (content: string) => { passages: Passage[]; errors: string[] };
  serialize: (passages: Passage[]) => string;
  trimSpan: (text: string, s: number, e: number) => [number, number] | null;
  placeSpan: (p: Passage, s: number, e: number, target: number | "new" | null) => Passage;
  mergeClusters: (p: Passage, from: number, into: number) => Passage;
  segments: (text: string, clusters: number[][][]) => Segment[];
};

const TEXT = "Ada met Bea. She smiled at her sister.";
const passage = (clusters: number[][][], extra = {}): Passage => ({ id: "seed-1", text: TEXT, clusters, ...extra });

describe("parseFile and serialize", () => {
  it("round-trips a file and keeps extra fields", () => {
    const line = JSON.stringify(passage([[[0, 3], [13, 16]]], { source: { world: "slime", turn: 2 }, reviewed: false }));
    const { passages, errors } = E.parseFile(line + "\n");
    expect(errors).toEqual([]);
    expect(E.serialize(passages)).toBe(line + "\n");
  });

  it("reports bad lines and repeated ids", () => {
    const good = JSON.stringify(passage([]));
    const { passages, errors } = E.parseFile([good, "{oops", good, JSON.stringify(passage([[[30, 99]]], { id: "x" }))].join("\n"));
    expect(passages.map((p) => p.id)).toEqual(["seed-1"]);
    expect(errors).toEqual(["line 2: not JSON", "line 3: repeats id seed-1", 'line 4: cluster 1 has a bad span [30,99]']);
  });

  it("refuses to save a span that sits in two clusters", () => {
    expect(() => E.serialize([passage([[[0, 3]], [[0, 3], [13, 16]]])])).toThrow("span [0, 3) is in two clusters");
  });

  it("counts offsets in code points, as Python does", () => {
    const p = { id: "e", text: "🙂 Ada", clusters: [[[2, 5]]] };
    expect(E.validate(p)).toEqual([]);
    // Five code points, six UTF-16 units: an end of 6 is past the text.
    expect(E.validate({ ...p, clusters: [[[2, 6]]] })).toEqual(["cluster 1 has a bad span [2,6]"]);
    expect(E.segments(p.text, p.clusters).find((s) => s.mentions.length)?.text).toBe("Ada");
  });
});

describe("edits", () => {
  // Ada [0,3) · Bea [8,11) · She [13,16) · her [27,30) · her sister [27,37)
  const p = passage([[[0, 3], [27, 30]], [[8, 11], [13, 16]]]);

  it("moves a mention to another cluster", () => {
    expect(E.placeSpan(p, 27, 30, 1).clusters).toEqual([[[0, 3]], [[8, 11], [13, 16], [27, 30]]]);
  });

  it("moves a mention into a new cluster and drops a mention", () => {
    expect(E.placeSpan(p, 13, 16, "new").clusters).toEqual([[[0, 3], [27, 30]], [[8, 11]], [[13, 16]]]);
    expect(E.placeSpan(p, 13, 16, null).clusters).toEqual([[[0, 3], [27, 30]], [[8, 11]]]);
  });

  it("drops a cluster that loses its last mention and keeps cluster order by first mention", () => {
    const one = passage([[[8, 11]], [[0, 3], [13, 16]]]);
    expect(E.placeSpan(one, 8, 11, 1).clusters).toEqual([[[0, 3], [8, 11], [13, 16]]]);
  });

  it("adds a nested mention around an existing one", () => {
    const added = E.placeSpan(p, 27, 37, "new");
    expect(added.clusters[2]).toEqual([[27, 37]]);
    const seg = E.segments(TEXT, added.clusters).find((s) => s.s === 27);
    expect(seg?.mentions).toEqual([[0, 27, 30], [2, 27, 37]]);
  });

  it("merges two clusters", () => {
    expect(E.mergeClusters(p, 1, 0).clusters).toEqual([[[0, 3], [8, 11], [13, 16], [27, 30]]]);
  });

  it("trims whitespace off a selected span", () => {
    expect(E.trimSpan(TEXT, 12, 17)).toEqual([13, 16]);
    expect(E.trimSpan(TEXT, 12, 13)).toBeNull();
  });
});

describe("segments", () => {
  it("cuts at words and at mention edges inside a word", () => {
    const segs = E.segments("Ada's cat", [[[0, 2]]]);
    expect(segs.map((s) => s.text)).toEqual(["Ad", "a", "'", "s", " ", "cat"]);
    expect(segs[0].mentions).toEqual([[0, 0, 2]]);
  });
});
