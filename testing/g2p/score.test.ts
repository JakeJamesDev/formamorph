import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { editDistance, gitBlob, normalize, scoreWords, setItems } from "./score.mjs";

const refs = (rows: Record<string, string[]>) => new Map(Object.entries(rows));

describe("normalize", () => {
  it("reads Kokoro notation and IPA as one spelling in American", () => {
    expect(normalize("bˈʌɾəɹ")).toBe(normalize("bʌtɚ"));
    expect(normalize("dˈA")).toBe(normalize("deɪ"));
    expect(normalize("ʧˈɜɹʧ")).toBe(normalize("tʃɝtʃ"));
  });

  it("keeps a real vowel difference", () => {
    expect(normalize("wˈIvəɹn")).not.toBe(normalize("wˈɪvəɹn"));
  });

  it("reads British long marks and the goat vowel, and does not collapse them into rhotic forms", () => {
    expect(normalize("ɡˈQ", "uk")).toBe(normalize("ɡəʊ", "uk"));
    expect(normalize("bɜː", "uk")).toBe("bɜ");
    expect(normalize("bɜː", "us")).toBe("bəɹ");
  });
});

describe("editDistance", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(editDistance("kæt", "kɑt")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
  });
});

describe("scoreWords", () => {
  const references = refs({ cat: ["kæt", "kɑt"], dog: ["dɔɡ"] });

  it("counts any listed variant as exact, and scores error against the nearest", async () => {
    const score = await scoreWords([["cat", 1], ["dog", 1]], references, async (w: string) => (w === "cat" ? "kˈɑt" : "dˈɔt"));
    expect(score.exact).toBe(50);
    expect(score.error).toBeCloseTo((100 * 1) / 6, 1);
  });

  it("weights by count, so a frequent word moves the score more", async () => {
    const score = await scoreWords([["cat", 9], ["dog", 1]], references, async (w: string) => (w === "cat" ? "kˈæt" : "dˈɑɡ"));
    expect(score.exact).toBe(90);
    const missed = await scoreWords([["cat", 9], ["dog", 1]], references, async (w: string) => (w === "cat" ? "kˈɔt" : "dˈɔɡ"));
    expect(missed.error).toBe(30);
  });

  it("leaves out words with no reference and function words, and still counts them in coverage", async () => {
    const withThe = refs({ cat: ["kæt"], the: ["ðə"] });
    const score = await scoreWords([["cat", 1], ["the", 2], ["zzyzx", 1]], withThe, async () => "kˈæt");
    expect(score.words).toBe(1);
    expect(score.coverage).toBe(25);
  });
});

describe("frozen sets", () => {
  it("holds the agreed word counts", () => {
    expect(setItems("unknown")).toHaveLength(1500);
    expect(setItems("strange")).toHaveLength(40);
    expect(setItems("fantasy")).toHaveLength(97);
    expect(setItems("known").reduce((n: number, [, c]: [string, number]) => n + c, 0)).toBe(40006);
  });

  it("holds words only, with no phoneme symbols", () => {
    for (const name of ["unknown", "strange", "fantasy", "known"]) {
      for (const [word] of setItems(name)) expect(word).toMatch(/^[A-Za-z']+$/);
    }
  });

  it("stores eSpeak as aggregates, with no per-word strings", () => {
    const { results } = JSON.parse(readFileSync(new URL("./espeak-reference.json", import.meta.url), "utf8"));
    for (const accent of ["us", "uk"]) {
      for (const name of ["unknown", "known", "strange", "fantasy"]) {
        for (const value of Object.values(results[accent][name])) expect(typeof value).toBe("number");
      }
    }
  });
});

describe("gitBlob", () => {
  it("matches git's hash of a known file", () => {
    expect(gitBlob(Buffer.from("hello\n")).slice(0, 12)).toBe("ce013625030b");
  });
});
