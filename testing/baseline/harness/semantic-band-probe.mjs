// Semantic-band probe — A/Bs the two digest-band trim strategies (A = oldest-first, the shipped default;
// B = relevance-ranked, the Semantic Memory toggle) on a fixed 28-digest story with planted old facts
// (../semantic-band-cases.json). Two stages:
//   1. TRIM (deterministic, no LLM): embeds digests + each case's query with the same MiniLM the app
//      uses, replicates buildBandedHistory's drop loops, and reports which digests survive each
//      strategy under a budget squeeze. This is the causal layer — B "wins" a case by keeping the
//      planted digest that A discards.
//   2. RECALL (LLM): sends the real narration system prompt + each strategy's recap band and counts
//      mustRecall token hits in the prose. Tokens never appear in the action text, so a hit proves the
//      band carried the memory. Run on both test targets.
// Scoring constants (half-life) and prompts are grabbed from src at runtime so the probe can't drift.
//
// Usage:
//   node semantic-band-probe.mjs --stage trim [--budget 340]
//   node semantic-band-probe.mjs --stage recall [--endpoint URL] [--model default] [--runs 3] [--only letter] [--budget 340]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "@huggingface/transformers";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const stage = argVal("--stage", "trim");
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const only = argVal("--only");
const runs = Number(argVal("--runs", "3"));
const budget = Number(argVal("--budget", "340")); // band token budget; default forces ~8 of 28 digests out
const cap = Number(argVal("--cap", "0")); // always-on top-K cap (step 3); 0 = off. Pair with a huge --budget to isolate it.
const maxTokens = Number(argVal("--max", "400"));
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const fixture = JSON.parse(await readFile(path.resolve(HARNESS_DIR, "../semantic-band-cases.json"), "utf8"));
const { world, playerTrait, location, digests, cases } = fixture;

// --- grab real prompt text + scoring constants from src (no drift) ---
const promptsSrc = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = promptsSrc.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = promptsSrc.indexOf("`", at) + 1;
  // Probes run English-only, where the language chip renders to nothing, and the arms that do test the
  // directive append their own wording — so the chip is stripped rather than left as a literal token.
  return promptsSrc.slice(from, promptsSrc.indexOf("`;", from)).replaceAll("<LANGUAGE>", "").trimEnd();
};
const SYS = grab("defaultSystemPrompt");
const RECAP = grab("defaultRecapUserPrompt");
const relevanceSrc = await readFile(path.join(REPO_ROOT, "src/lib/memoryRelevance.ts"), "utf8");
const HALF_LIFE = Number(relevanceSrc.match(/RELEVANCE_HALF_LIFE_TURNS = (\d+)/)[1]);
const MODEL_ID = relevanceSrc.match(/EMBEDDING_MODEL_ID = '([^']+)'/)[1];
const bandingSrc = await readFile(path.join(REPO_ROOT, "src/lib/turnBanding.ts"), "utf8");
const RECENT_IMMUNE = Number(bandingSrc.match(/RANKED_RECENT_IMMUNE = (\d+)/)[1]);

// --- replicate the app's band math (turnBanding.ts) ---
const estimateTokens = (chars) => Math.ceil(Math.max(0, chars) / 4);
const bandCost = (texts, nowLine) => {
  if (texts.length === 0) return 0;
  const body = texts.join(" ");
  const pair = [
    { role: "user", content: RECAP },
    { role: "assistant", content: nowLine ? `${body}\n\n${nowLine}` : body },
  ];
  return estimateTokens(JSON.stringify(pair).length);
};

const nowLineFor = (c) => {
  const present = c.participants?.length ? ` with ${c.participants.join(", ")} present` : "";
  return `Now you are at ${location}${present}; the scene is already underway.`;
};

// A: production oldest-first (bandTurns.slice(1) until it fits).
const trimOldest = (items, nowLine) => {
  let band = [...items];
  while (bandCost(band.map((i) => i.text), nowLine) > budget && band.length > 0) band = band.slice(1);
  return band;
};
// B: production ranked drop — index 0 and the newest RECENT_IMMUNE are protected; the middle competes;
// an all-protected band falls back to oldest-first (mirrors buildBandedHistory exactly).
const trimRanked = (items, scores, nowLine) => {
  let band = [...items];
  const dropLowest = () => {
    const lastEligible = band.length - 1 - RECENT_IMMUNE;
    if (lastEligible < 1) return false;
    let lowest = 1;
    for (let i = 2; i <= lastEligible; i++) if (scores.get(band[i].idx) < scores.get(band[lowest].idx)) lowest = i;
    band = band.slice(0, lowest).concat(band.slice(lowest + 1));
    return true;
  };
  while (bandCost(band.map((i) => i.text), nowLine) > budget && band.length > 0) {
    if (!dropLowest()) band = band.slice(1);
  }
  // Always-on top-K cap (step 3), mirroring buildBandedHistory: protected-ends floor applies.
  if (cap > 0) {
    const floor = Math.max(cap, 1 + RECENT_IMMUNE);
    while (band.length > floor && dropLowest()) { /* trimmed */ }
  }
  return band;
};

// --- embeddings (same model id as the app; node caches under ~/.cache/huggingface) ---
console.log(`Loading ${MODEL_ID} (q8, first run downloads ~23 MB)…`);
const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
const embed = async (texts) => {
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  const [n, d] = out.dims;
  return Array.from({ length: n }, (_, r) => out.data.slice(r * d, (r + 1) * d));
};
const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

const digestVecs = await embed(digests);
const items = digests.map((text, idx) => ({ text, idx }));

const scoresFor = async (c) => {
  // Query mirrors computeRelevanceScores: the bare action. Appending location/participants poisoned
  // ranking (location terms dominate — the letter target ranked 15/28 with the clause, 5/28 without).
  const [qv] = await embed([c.action]);
  const scores = new Map();
  digests.forEach((_, i) => {
    const age = digests.length - 1 - i;
    scores.set(i, cos(qv, digestVecs[i]) * Math.pow(0.5, age / HALF_LIFE));
  });
  return scores;
};

const pick = cases.filter((c) => !only || c.name.includes(only));

// ---------- stage 1: trim ----------
if (stage === "trim") {
  console.log(`\nTrim stage · budget ${budget} tok · ${digests.length} digests · half-life ${HALF_LIFE}\n`);
  let wins = 0, targets = 0, controlOk = null;
  for (const c of pick) {
    const nowLine = nowLineFor(c);
    const scores = await scoresFor(c);
    const A = trimOldest(items, nowLine);
    const B = trimRanked(items, scores, nowLine);
    const aIdx = new Set(A.map((i) => i.idx));
    const bIdx = new Set(B.map((i) => i.idx));
    const aDrop = items.filter((i) => !aIdx.has(i.idx)).map((i) => i.idx);
    const bDrop = items.filter((i) => !bIdx.has(i.idx)).map((i) => i.idx);
    console.log(`=== ${c.name} ===`);
    console.log(`  A drops: [${aDrop.join(",")}]  B drops: [${bDrop.join(",")}] (both ${aDrop.length} drops)`);
    if (c.targetIndex >= 0) {
      targets++;
      const aKeep = aIdx.has(c.targetIndex), bKeep = bIdx.has(c.targetIndex);
      if (!aKeep && bKeep) wins++;
      console.log(`  target #${c.targetIndex} "${digests[c.targetIndex].slice(0, 60)}…"`);
      console.log(`  survives: A=${aKeep ? "KEPT" : "dropped"}  B=${bKeep ? "KEPT" : "dropped"}  ${!aKeep && bKeep ? "→ B WIN" : aKeep && bKeep ? "(both keep — squeeze harder?)" : bKeep ? "" : "→ B MISS"}`);
    } else {
      // Control: the recency guard's contract — the newest RECENT_IMMUNE digests always survive in B.
      const guarded = items.slice(-RECENT_IMMUNE).map((i) => i.idx);
      controlOk = guarded.every((i) => bIdx.has(i));
      const newest6 = items.slice(-6).filter((i) => bIdx.has(i.idx)).length;
      console.log(`  control: guarded newest ${RECENT_IMMUNE} survive in B = ${controlOk ? "YES" : "NO — guard broken"} · newest 6 kept: ${newest6}/6`);
    }
    console.log(`  opening #0: A=${aIdx.has(0) ? "kept" : "DROPPED"}  B=${bIdx.has(0) ? "kept (immune)" : "DROPPED (bug!)"}`);
  }
  console.log(`\nTargets kept by B and lost by A: ${wins}/${targets}` + (controlOk === null ? "" : ` · control recency: ${controlOk ? "OK" : "FAIL"}`));
}

// ---------- stage 2: recall ----------
if (stage === "recall") {
  const renderSys = () =>
    SYS
      .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
      .replaceAll("<MARKDOWN GUIDANCE>", "")
      .replaceAll("<WORLD DESCRIPTION>", world)
      .replaceAll("<DICTIONARY|before>", "N/A")
      .replaceAll("<STATS DESCRIPTION|descriptions.markdown>", "- **Resolve:** steady\n- **Coin:** light")
      .replaceAll("<TRAITS DESCRIPTION|markdown>", `- **Identity:** ${playerTrait}`)
      .replaceAll("<NOTES>", "None")
      .replaceAll("<LOCATION|markdown>", `- **name:** ${location}`)
      .replaceAll("<LOCATION|sublocations.summary.markdown>", "N/A")
      .replaceAll("<LOCATION|reachable.summary.markdown>", "N/A")
      .replaceAll("<ENTITIES|markdown>", "N/A")
      .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
      .replaceAll("<ENTITIES|reachable.summary.markdown>", "N/A")
      .replaceAll("<DICTIONARY>", "N/A");

  const call = async (messages, seed) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const body = {
      model,
      messages: [{ role: "system", content: renderSys() }, ...messages],
      max_tokens: maxTokens, stream: false, reasoning_effort: "none", // narration is unpinned — no temperature
    };
    if (seed !== undefined) body.seed = seed; // honored by llama.cpp; the cloud endpoint ignores it
    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    return (j.choices?.[0]?.message?.content ?? "").trim();
  };

  console.log(`\nRecall stage · ${endpoint} · model "${model}" · ${runs} run(s)/arm · budget ${budget}\n`);
  await call([{ role: "user", content: "warm up" }], 1).catch(() => {});

  const tally = { A: { hits: 0, total: 0 }, B: { hits: 0, total: 0 } };
  for (const c of pick.filter((c) => c.targetIndex >= 0)) {
    const nowLine = nowLineFor(c);
    const scores = await scoresFor(c);
    const bands = { A: trimOldest(items, nowLine), B: trimRanked(items, scores, nowLine) };
    for (const arm of ["A", "B"]) {
      const body = bands[arm].map((i) => i.text).join(" ");
      const messages = [
        { role: "user", content: RECAP },
        { role: "assistant", content: `${body}\n\n${nowLine}` },
        { role: "user", content: c.action }, // bare action — no wrapper, matching production
      ];
      for (let r = 0; r < runs; r++) {
        let out, err = null;
        try { out = await call(messages, 100 + r); } catch (e) { err = String(e.message || e); }
        tally[arm].total++;
        if (err) { console.log(`  ${c.name} ${arm}#${r + 1} ERROR: ${err}`); continue; }
        const hit = c.mustRecall.some((t) => new RegExp(`\\b${t}`, "i").test(out));
        if (hit) tally[arm].hits++;
        console.log(`  ${c.name} ${arm}#${r + 1} ${hit ? "RECALL" : "no-recall"} · ${out.replace(/\s+/g, " ").slice(0, 110)}…`);
      }
    }
  }
  const pct = (t) => (t.total ? `${t.hits}/${t.total} (${Math.round((100 * t.hits) / t.total)}%)` : "n/a");
  console.log(`\nRecall — A oldest-first: ${pct(tally.A)} · B ranked: ${pct(tally.B)}`);
}
