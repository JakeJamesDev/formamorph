import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM module without types
import { createServer, dataFile } from "./seed-editor-server.mjs";

const LINE = JSON.stringify({ id: "seed-1", text: "Ada met Bea. She smiled.", clusters: [[[8, 11], [13, 16]]] }) + "\n";
let root: string;
let server: http.Server;
let port: number;

beforeAll(async () => {
  root = mkdtempSync(path.join(os.tmpdir(), "seed-editor-"));
  mkdirSync(path.join(root, "coref", "corpus"), { recursive: true });
  writeFileSync(path.join(root, "coref", "corpus", "set.jsonl"), LINE);
  writeFileSync(path.join(root, "coref", "notes.txt"), "not data");
  writeFileSync(path.join(path.dirname(root), "outside.jsonl"), LINE);
  server = createServer(root);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(path.join(path.dirname(root), "outside.jsonl"), { force: true });
});

/** A raw request, so the test controls the Host header and unnormalized paths. */
const request = (method: string, urlPath: string, body = "", host = `localhost:${port}`) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: urlPath, headers: { Host: host } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    req.end(body);
  });

describe("dataFile", () => {
  it("names an existing .jsonl inside the root", () => {
    expect(dataFile(root, "/data/coref/corpus/set.jsonl")).toBe(path.join(root, "coref", "corpus", "set.jsonl"));
  });

  it("refuses paths outside the root, other extensions and missing files", () => {
    expect(dataFile(root, "/data/../outside.jsonl")).toBeNull();
    expect(dataFile(root, "/data/..%2Foutside.jsonl")).toBeNull();
    expect(dataFile(root, "/data/coref/notes.txt")).toBeNull();
    expect(dataFile(root, "/data/coref/corpus/new.jsonl")).toBeNull();
    expect(dataFile(root, "/data/%E0%A4%A")).toBeNull();
  });
});

describe("the server", () => {
  it("keeps the file choice when it sends / to the editor", async () => {
    const res = await new Promise<http.IncomingMessage>((resolve) =>
      http.get({ host: "127.0.0.1", port, path: "/?file=coref/corpus/set.jsonl", headers: { Host: `localhost:${port}` } }, resolve));
    res.resume();
    expect(res.headers.location).toBe("/seed-editor.html?file=coref/corpus/set.jsonl");
  });

  it("serves the editor and a data file", async () => {
    expect((await request("GET", "/seed-editor.html")).body).toContain("<title>Seed Correction");
    expect((await request("GET", "/data/coref/corpus/set.jsonl")).body).toBe(LINE);
  });

  it("writes a valid save back to the file", async () => {
    const next = LINE.replace("seed-1", "seed-2");
    expect((await request("PUT", "/data/coref/corpus/set.jsonl", next)).status).toBe(204);
    expect(readFileSync(path.join(root, "coref", "corpus", "set.jsonl"), "utf8")).toBe(next);
  });

  it("refuses a save that does not parse, and keeps the file", async () => {
    const before = readFileSync(path.join(root, "coref", "corpus", "set.jsonl"), "utf8");
    const res = await request("PUT", "/data/coref/corpus/set.jsonl", "{oops\n");
    expect(res.status).toBe(400);
    expect(readFileSync(path.join(root, "coref", "corpus", "set.jsonl"), "utf8")).toBe(before);
  });

  it("refuses a write outside the root", async () => {
    expect((await request("PUT", "/data/../outside.jsonl", "")).status).toBe(404);
    expect(readFileSync(path.join(path.dirname(root), "outside.jsonl"), "utf8")).toBe(LINE);
  });

  it("refuses a request to a non-loopback host name", async () => {
    expect((await request("PUT", "/data/coref/corpus/set.jsonl", LINE, "evil.example:80")).status).toBe(403);
  });
});
