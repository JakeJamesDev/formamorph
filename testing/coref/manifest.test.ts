import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gate, main, report } from "./manifest.mjs";

const set = (f1: number, sha256 = "s1") => ({ f1, sha256 });

describe("gate", () => {
  it("passes a first publish", () => {
    expect(gate({ "litbank-dev": set(0.5) }, null).ok).toBe(true);
  });

  it("passes a model that is higher on one set and equal on the rest", () => {
    const v = gate({ "litbank-dev": set(0.6), "narration-dev": set(0.4, "n") }, { "litbank-dev": set(0.5), "narration-dev": set(0.4, "n") });
    expect(v).toEqual({ ok: true, reasons: [] });
  });

  it("refuses a tie on every set", () => {
    const v = gate({ "litbank-dev": set(0.5) }, { "litbank-dev": set(0.5) });
    expect(v.ok).toBe(false);
    expect(v.reasons).toEqual(["ties the published version on every dev set"]);
  });

  it("refuses a model below the published one on any set, even when higher elsewhere", () => {
    const v = gate({ "litbank-dev": set(0.7), "narration-dev": set(0.39, "n") }, { "litbank-dev": set(0.5), "narration-dev": set(0.4, "n") });
    expect(v.ok).toBe(false);
    expect(v.reasons).toEqual(["narration-dev: 0.39 is below the published 0.4"]);
  });

  it("refuses when a published dev set is missing or changed since publish", () => {
    expect(gate({ "litbank-dev": set(0.9) }, { "litbank-dev": set(0.5), "narration-dev": set(0.4, "n") }).reasons)
      .toEqual(["narration-dev: the candidate has no score"]);
    expect(gate({ "litbank-dev": set(0.9, "s2") }, { "litbank-dev": set(0.5) }).reasons[0]).toMatch(/dev set changed/);
  });

  it("ignores a set the published version never had", () => {
    expect(gate({ "litbank-dev": set(0.6), "narration-dev": set(0.1, "n") }, { "litbank-dev": set(0.5) }).ok).toBe(true);
  });
});

describe("report", () => {
  it("lists the change per set, and no change for a set that differs or is one-sided", () => {
    expect(report({ "litbank-dev": set(0.6), "narration-dev": set(0.3, "n2") }, { "litbank-dev": set(0.5), "narration-dev": set(0.4, "n") }))
      .toEqual([
        { set: "litbank-dev", published: 0.5, candidate: 0.6, change: 0.1 },
        { set: "narration-dev", published: 0.4, candidate: 0.3, change: null },
      ]);
  });
});

describe("publish", () => {
  let dir: string, exp: string, out: string;
  const write = (path: string, data: unknown) => writeFileSync(path, typeof data === "string" ? data : JSON.stringify(data));
  const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  const scores = (f1: number, exportDir = exp) => {
    const path = join(dir, `scores-${f1}.json`);
    write(path, { model: { arch: "fcoref", export: exportDir }, dev: { "litbank-dev": { f1, sha256: "s1" } }, gold: {} });
    return path;
  };
  const quiet = () => undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "coref-manifest-"));
    exp = join(dir, "export");
    out = join(dir, "out");
    mkdirSync(exp);
    write(join(exp, "graph_a.onnx"), "graph a bytes");
    write(join(exp, "graph_b.onnx"), "graph b");
    write(join(exp, "tokenizer.json"), "{}");
    write(join(exp, "host-config.json"), { architecture: "fcoref", graphContract: 1 });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const publish = (extra: string[]) =>
    main(["publish", "--model", "small", "--export", exp, "--base-url", "https://models.example/coref/", "--out", out, ...extra], quiet);

  it("first publish: with no manifest at --current, writes version 1 with URLs, sizes and hashes, and the upload folder", async () => {
    await publish(["--scores", scores(0.5), "--current", join(dir, "none-yet.json")]);
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    const entry = manifest.models.small;
    expect(manifest.format).toBe(1);
    expect(entry).toMatchObject({ version: 1, architecture: "fcoref", minHostVersion: 1, scores: { "litbank-dev": { f1: 0.5, sha256: "s1" } } });
    expect(entry.files.graph_a).toEqual({ url: "https://models.example/coref/small/1/graph_a.onnx", size: 13, sha256: sha(join(exp, "graph_a.onnx")) });
    expect(Object.keys(entry.files)).toEqual(["graph_a", "graph_b", "tokenizer", "hostConfig"]);
    expect(readFileSync(join(out, "small", "1", "graph_b.onnx"), "utf8")).toBe("graph b");
  });

  it("bumps the version and keeps the other model's entry", async () => {
    const current = join(dir, "current.json");
    write(current, { format: 1, models: { big: { version: 4 }, small: { version: 2, scores: { "litbank-dev": set(0.5) } } } });
    const manifest = await publish(["--scores", scores(0.55), "--current", current]);
    expect(manifest.models.big).toEqual({ version: 4 });
    expect(manifest.models.small.version).toBe(3);
  });

  it("refuses a lower-scoring model and writes nothing", async () => {
    const current = join(dir, "current.json");
    write(current, { format: 1, models: { small: { version: 2, scores: { "litbank-dev": set(0.5) } } } });
    await expect(publish(["--scores", scores(0.49), "--current", current])).rejects.toThrow(/below the published 0.5/);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  it("refuses scores taken from another export", async () => {
    await expect(publish(["--scores", scores(0.5, join(dir, "elsewhere")), "--current", join(dir, "none-yet.json")])).rejects.toThrow(/not taken from/);
  });

  it("needs --current", async () => {
    await expect(publish(["--scores", scores(0.5)])).rejects.toThrow(/missing --current/);
  });
});
