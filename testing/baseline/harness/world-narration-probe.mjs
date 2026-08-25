// World-narration probe — fires the real narration system prompt (defaultSystemPrompt) assembled from an
// ACTUAL bundled world (src/defaultworlds/<id>.json) at an endpoint, and chains 3 scripted turns per world,
// so a world's authored voice (system prompt, lore, stats, traits, cue) can be judged on the model players
// use. Complements narration-probe.mjs, which tests the pipeline on a synthetic neutral world; this one
// tests the world content itself. Placeholder chips are resolved per run (deterministic rotation), default
// traits are applied, and the lore book is simplified: constant/before entries always injected, other
// entries injected when a keyword appears in the turn's action text (no scan-depth/recursion emulation).
// Objective red flags per world are auto-noted; prose quality is eyeballed.
//
// Usage:  node world-narration-probe.mjs [--endpoint URL] [--model default] [--world valentines|rampage|drone]
//                                        [--runs 2] [--max 400] [--seed 11]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");

const args = process.argv.slice(2);
const argVal = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const endpoint = argVal("--endpoint", "https://api.lyonade.net/v1/chat/completions");
const model = argVal("--model", "default");
const onlyWorld = argVal("--world");
const runs = Number(argVal("--runs", "2"));
const maxTokens = Number(argVal("--max", "400"));
const baseSeed = Number(argVal("--seed", "11"));
const token = argVal("--token", process.env.PROBE_TOKEN || "");

const source = await readFile(path.join(REPO_ROOT, "src/components/game/GamePrompts.ts"), "utf8");
const grab = (name) => {
  const at = source.indexOf(name + " = `");
  if (at === -1) throw new Error("missing " + name);
  const from = source.indexOf("`", at) + 1;
  return source.slice(from, source.indexOf("`;", from)).replaceAll("<LANGUAGE>", "").trimEnd();
};
const SYS = grab("defaultSystemPrompt");

const MARKDOWN_ON = `## Formatting
- Write immersive, flowing prose - never a list, menu, or table.
- Reach for Markdown emphasis where it genuinely lands: **bold** the single most important noun of the moment (a threat, a key object, a revealed name) and *italicize* a sharp inner thought, sound, or stressed word - because the moment earns it, not to fill a quota.`;

// The scripted turns and world-specific red flags. Actions are written in the player voice the app sends
// (bare text, no wrapper). Flags are objective vision checks: tone floors and mechanics the world's own
// prompt asserts. Informational counters (info) are wanted-behavior sightings, not failures.
const WORLDS = {
  valentines: {
    actions: [
      "I duck low behind the desks and slide toward the classroom door before anyone can stand up.",
      "Hana corners me by the shoe lockers with her enormous box. I take one polite bite to stall, then bolt for the courtyard.",
    ],
    flags: (text) => {
      const f = [];
      if (/\bblood(y|ied)?\b|\bgore\b|\bcorpse|\bbroken (arm|leg|bone)/i.test(text)) f.push("TONE-GORE");
      return f;
    },
    info: (text) => ({
      chocolate: /chocolat/i.test(text),
      sugar: /\bsugar\b/i.test(text),
      swarm: /\bswarm|admirer|fan club/i.test(text),
    }),
  },
  rampage: {
    actions: [
      "I wade ashore, plant one foot on the pier, and flatten the first row of container cranes.",
      "I roar back at the news chopper circling my head, then start toward the glow of downtown.",
    ],
    flags: (text) => {
      const f = [];
      if (/\bblood(y|ied)?\b|\bgore\b|corpse|crushed bod|trampled (bod|corpse|people)/i.test(text)) f.push("TONE-GORE");
      // Alert starts ~4: the endgame countermeasure must not appear in the first turns.
      if (/\bAegis\b/i.test(text)) f.push("PREMATURE-AEGIS");
      return f;
    },
    info: (text) => ({
      escape: /escap|scramble|flee|narrowly|dive[sd]? (clear|aside)/i.test(text),
      codename: /VANTABLACK|COLOSSUS-9|TIDEBREAKER|SUBJECT MERIDIAN/i.test(text),
      military: /police|siren|cordon|guard/i.test(text),
    }),
  },
  drone: {
    actions: [
      "I chirp twice at the stranger and nod my turret in what I hope reads as a friendly greeting.",
      "Something snarls behind the rubble - I pivot, fire one warning shot, and dash for cover.",
    ],
    flags: (text) => {
      const f = [];
      // The drone cannot speak: no quoted words may come from the player.
      if (/["“][^"”\n]{2,}["”][^\n]{0,20}\b(you|your voice)\b[^\n]{0,12}\b(say|reply|answer|call|shout|speak)/i.test(text) ||
          /\byou (say|reply|answer|shout|call out|speak)\b[^\n]{0,20}["“]/i.test(text)) f.push("DRONE-SPEAKS");
      return f;
    },
    info: (text) => ({
      machineVoice: /chirp|servo|whir|beep|turret|optic/i.test(text),
      power: /\bpower\b|charge|battery/i.test(text),
    }),
  },
};

// ---------- assembly from the real world JSON ----------
const loadWorld = async (id) => JSON.parse(await readFile(path.join(REPO_ROOT, `src/defaultworlds/${id}.json`), "utf8"));

// Deterministic per-run placeholder resolution: run r takes value (r + offset) % n, so runs see variety
// and reruns see the same roll. All chips of one placeholder share the roll (world mode).
const resolveChips = (text, placeholders, run) => {
  if (typeof text !== "string") return text;
  return text.replace(/\{\{ph:([0-9a-f-]+):[^:}]+:[^}]+\}\}/g, (m, id) => {
    const ph = placeholders.find((p) => p.id === id);
    if (!ph?.values?.length) return "";
    return ph.values[run % ph.values.length];
  });
};

const band = (stat) => {
  const max = stat.max ?? 100;
  const value = stat.value ?? stat.starting ?? max;
  const pct = stat.thresholdUnit === "percent";
  const scale = (t) => (pct ? (stat.min ?? 0) + (t / 100) * (max - (stat.min ?? 0)) : t);
  const hit = [...(stat.descriptors ?? [])].sort((a, b) => a.threshold - b.threshold).find((d) => value <= scale(d.threshold));
  return hit?.description ?? "";
};

function renderWorld(w, run, startId) {
  const ph = w.placeholders ?? [];
  const R = (t) => resolveChips(t, ph, run);
  const start = w.locations.find((l) => l.id === startId);
  const kids = w.locations.filter((l) => l.parentId === start.id);
  const connected = (w.connections ?? [])
    .filter((c) => c.from === start.id || (c.twoWay && c.to === start.id))
    .map((c) => ({ loc: w.locations.find((l) => l.id === (c.from === start.id ? c.to : c.from)), via: c.aiHint }));
  const here = w.entities.filter((e) => (e.locations ?? []).includes(start.id));
  const away = w.entities.filter((e) => !(e.locations ?? []).includes(start.id));
  const entityMd = (list, summary) => list.length
    ? list.map((e) => `- **${R(e.name)}**\n  - **description:** ${R(summary ? (e.aiSummary ?? e.aiDescription) : (e.aiDescription ?? ""))}\n  - **type:** ${e.type || "N/A"}`).join("\n")
    : "N/A";
  const activeTraits = w.traits.filter((t) => t.isDefault);
  const groupHead = (t) => w.traitGroups?.find((g) => g.id === t.groupId)?.aiDescription;
  const stats = w.stats.filter((s) => s.enabled !== false);
  const books = (w.dictionaries ?? []).filter((b) => b.enabled !== false);
  const entries = books.flatMap((b) => b.entries.filter((e) => e.enabled !== false));
  const beforeBlock = entries.filter((e) => e.constant && e.position === "before");
  const restConst = entries.filter((e) => e.constant && e.position !== "before");
  const dictMd = (list) => (list.length ? list.map((e) => `**${e.name}:** ${R(e.value)}`).join("\n") : "N/A");

  const sys = SYS
    .replaceAll("<LENGTH GUIDANCE>", "Aim for two to four tight paragraphs; land the moment and stop.")
    .replaceAll("<MARKDOWN GUIDANCE>", MARKDOWN_ON)
    .replaceAll("<WORLD DESCRIPTION>", R(w.worldOverview.systemPrompt))
    .replaceAll("<DICTIONARY|before>", dictMd(beforeBlock))
    .replaceAll("<STATS DESCRIPTION|descriptions.markdown>",
      stats.map((s) => `- **${s.name}:** ${s.value ?? s.starting ?? s.max}/${s.max} — ${band(s)}`).join("\n"))
    .replaceAll("<TRAITS DESCRIPTION|markdown>",
      activeTraits.map((t) => `- **${groupHead(t) ? groupHead(t) + " " : ""}${t.name}:** ${R(t.aiDescription ?? "")}`).join("\n") || "N/A")
    .replaceAll("<NOTES>", "None")
    .replaceAll("<LOCATION|markdown>", `- **name:** ${start.name}\n- **description:** ${R(start.aiDescription ?? "")}`)
    .replaceAll("<LOCATION|sublocations.summary.markdown>",
      kids.length ? kids.map((l) => `- **${l.name}:** ${R(l.aiSummary ?? l.aiDescription ?? "")}`).join("\n") : "N/A")
    .replaceAll("<LOCATION|reachable.summary.markdown>",
      connected.length ? connected.map((c) => `- **${c.loc.name}**${c.via ? ` — via ${c.via}` : ""}: ${R(c.loc.aiSummary ?? c.loc.aiDescription ?? "")}`).join("\n") : "N/A")
    .replaceAll("<ENTITIES|markdown>", entityMd(here, false))
    .replaceAll("<ENTITIES|sublocations.markdown>", "N/A")
    .replaceAll("<ENTITIES|reachable.summary.markdown>", entityMd(away, true))
    .replaceAll("<DICTIONARY>", dictMd(restConst));

  // Keyword-activated lore is appended per turn against the action text (simplified activation).
  const keyed = entries.filter((e) => !e.constant);
  const activate = (turnText) =>
    keyed.filter((e) => (e.key ?? []).some((k) => turnText.toLowerCase().includes(k.toLowerCase())));
  return { sys, activate, dictMd, R, startName: start.name };
}

async function call(sys, messages, seed) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sys }, ...messages],
      max_tokens: maxTokens, stream: false, seed, // narration is unpinned — no temperature, endpoint decides
      reasoning_effort: "none",
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

const commonFlags = (text) => {
  const f = [];
  if (!text) f.push("EMPTY");
  if (/\{\{ph:/.test(text)) f.push("PH-LEAK");
  if (text && !/\byou\b|\byour\b/i.test(text)) f.push("NO-2ND-PERSON");
  if (/\b(what (do|would|will) you|choose one|choose from|your options?|options?:|pick one)\b/i.test(text)) f.push("OFFERS-CHOICES");
  return f;
};

const ids = Object.keys(WORLDS).filter((id) => !onlyWorld || id === onlyWorld);
console.log(`World-narration probe · ${endpoint} · model "${model}" · worlds: ${ids.join(", ")} · ${runs} run(s)\n`);

const agg = { total: 0, flagged: 0 };
for (const id of ids) {
  const w = await loadWorld(id);
  const spec = WORLDS[id];
  const starts = w.locations.filter((l) => l.isStarting);
  for (let r = 0; r < runs; r++) {
    const startId = (starts.length ? starts[r % starts.length] : w.locations[0]).id;
    const { sys, activate, dictMd, R, startName } = renderWorld(w, r, startId);
    const cue = R(w.worldOverview.openingCue ?? "The scene opens.");
    const turns = [cue, ...spec.actions];
    const history = [];
    console.log(`\n═══ ${id} #${r + 1} · start: ${startName} ═══`);
    for (let t = 0; t < turns.length; t++) {
      const lore = activate(turns[t]);
      const sysTurn = lore.length ? sys + `\n\n## Foreground Lore\n${dictMd(lore)}` : sys;
      history.push({ role: "user", content: turns[t] });
      let out, err = null;
      try { out = await call(sysTurn, history, baseSeed + r); } catch (e) { err = String(e.message || e); }
      agg.total++;
      if (err) { console.log(`\n--- turn ${t + 1} ERROR: ${err}`); history.pop(); continue; }
      history.push({ role: "assistant", content: out });
      const f = [...commonFlags(out), ...spec.flags(out)];
      if (f.length) agg.flagged++;
      const info = Object.entries(spec.info(out)).map(([k, v]) => `${k}:${v ? "✓" : "–"}`).join(" ");
      console.log(`\n--- turn ${t + 1} ${f.length ? "⚠ " + f.join(",") : "✓"} [${info}]`);
      console.log(`  action: ${turns[t]}`);
      console.log(out.split("\n").map((l) => "  " + l).join("\n"));
    }
  }
}
console.log(`\n${agg.total - agg.flagged}/${agg.total} turns without red flags (voice/tone quality: read the prose above).`);
