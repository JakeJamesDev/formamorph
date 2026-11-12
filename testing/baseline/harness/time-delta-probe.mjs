// TIME-DELTA probe (Probe A of docs-internal/designs/time-system/design.md) — can the model actually measure how
// much in-world time a turn consumed? This is the gate for phase 2's clock pass ('timePassed').
//
// Each case in ../time-delta-cases.json is a real-shaped (action, narration) pair with a ground-truth
// range in hours, chosen wide enough that any reasonable reading lands inside it. Cases cover the short
// end (an exchange, a scuffle), the middle (a walk, a meal, a night's sleep), and stated time in BOTH
// directions — a three-week skip that must be honored, and a stated ten minutes that must NOT be read as
// a long skip. That pair is the false-positive guard: a model that treats every stated interval as a
// timeskip passes `stated-skip` and fails `stated-short`.
//
// Baseline to beat is the flat hour the game charges today, scored against the same ranges — it is right
// only by luck, and the probe prints it so the comparison is explicit rather than assumed.
//
// The prompt comes from the REAL GamePrompts.ts at runtime, so editing the prompt is all that is needed
// between runs. Sampler matches the app's pin (timePassed: temperature 0).
//
//   node time-delta-probe.mjs --endpoint https://api.lyonade.net/v1/chat/completions --model default --runs 12
//   node time-delta-probe.mjs --runs 3 [--only sleep] [--verbose]
//   --arms none,daypart,24h,anchor,schema  interleaved per run: no start time (shipped), a start-time line in the
//     TIME chip's daypart or 24h style, or "until <time of day>" replies that code converts to a delta.
//     schema forces {ends_at, count, unit} through response_format; ends_at wins when set.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";
import { parseArgs, callMessages, grab } from "./planner-probe-lib.mjs";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HARNESS_DIR, "../../..");
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const VERBOSE = args.includes("--verbose");
const ONLY = argVal("--only", null);
const opts = parseArgs(process.argv, { runs: "3" });
const SHOW_PROMPT = args.includes("--show-prompt");
const ARMS = argVal("--arms", "none,daypart,24h").split(",");

// The real parser, so the probe scores exactly what the app would store — clamp, fallback and all.
const clockTs = await readFile(path.join(REPO_ROOT, "src/lib/gameClock.ts"), "utf8");
const { code } = await transform(clockTs, { loader: "ts", format: "esm" });
const clock = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

const SYS = grab("defaultTimePassedPrompt");
const USER = grab("defaultTimePassedUserPrompt").replaceAll("\\\n", ""); // a template-literal line continuation evaluates to nothing
const cases = JSON.parse(await readFile(path.join(HARNESS_DIR, "../time-delta-cases.json"), "utf8"))
  .filter((c) => !ONLY || c.id === ONLY);

const fmt = (h) => (h >= 24 ? `${(h / 24).toFixed(1)}d` : h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}m`);
const inRange = (h, c) => h !== null && h >= c.min && h <= c.max;

// Fills a chip token the way promptHeader's markdown form renders one with a header.
const chip = (text, name, value) =>
  text.replace(new RegExp(`<${name}(?:\\|[^>]*?header="([^"]*)")?[^>]*>`), (_, header) => (header ? `\n## ${header}\n${value}\n` : value));
const userFor = (c, arm) => startLine(c, arm) + chip(chip(USER, "PLAYER ACTION", c.action), "NARRATION", c.narration).trim();

// The case's start hour on day 2, rendered by the real clock formatter the TIME chip uses.
const startLine = (c, arm) => {
  if (arm !== "daypart" && arm !== "24h") return "";
  const elapsed = 24 + c.start - clock.DEFAULT_START_HOUR;
  return `When the character acted, it was ${clock.formatStoryTime(elapsed, undefined, arm, true)}.\n\n`;
};

// The anchor arm: the model may name the time of day the passage ends at, and code turns it into a
// delta from the start hour, so the model never does clock arithmetic and never sees the clock.
const ANCHOR_HOURS = { dawn: 6, morning: 8, noon: 12, afternoon: 13, evening: 17, nightfall: 20, midnight: 24 };
const ANCHOR_SYS = SYS
  .replace("- When no time passes at all",
    `- When the passage ends at a time of day rather than after a length of time, answer with the word until and that time of day instead of a count. The times of day are: ${Object.keys(ANCHOR_HOURS).join(", ")}.\n- When no time passes at all`)
  .replace("Your entire reply is that count and its unit,", "Your entire reply is that count and its unit, or until and a time of day,");
if (ANCHOR_SYS === SYS) throw new Error("anchor edits did not apply to the shipped prompt");
const parseAnchor = (reply, start) => {
  const m = reply.match(new RegExp(`\\buntil\\s+(?:the\\s+)?(${Object.keys(ANCHOR_HOURS).join("|")})\\b`, "i"));
  if (!m) return clock.parseTimeDelta(reply);
  const d = (ANCHOR_HOURS[m[1].toLowerCase()] - start + 24) % 24;
  return d === 0 ? 24 : d;
};
// The schema arm: the anchor decision first, then a count and unit, forced by response_format.
const SCHEMA_UNITS = { minutes: 1 / 60, hours: 1, days: 24, weeks: 168 };
const SCHEMA_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "time_passed", strict: true,
    schema: {
      type: "object", additionalProperties: false, required: ["ends_at", "count", "unit"],
      properties: {
        ends_at: { type: "string", enum: ["none", ...Object.keys(ANCHOR_HOURS)] },
        count: { type: "integer", minimum: 0 },
        unit: { type: "string", enum: Object.keys(SCHEMA_UNITS) },
      },
    },
  },
};
const SCHEMA_SYS = `You measure how much time passes in a story. You are given what the character did and what happened next.

Answer with three fields:
- ends_at: when the passage ends at a time of day rather than after a length of time, that time of day. Otherwise none.
- count and unit: how long it took, as a whole number of ${Object.keys(SCHEMA_UNITS).join(", ")}.

- A brief exchange, a glance, a few words traded: some number of minutes.
- A conversation, a walk across town, a meal, a night's sleep, a task seen through: some number of hours.
- An overland journey, a long convalescence, a season of training: some number of days or weeks.
- When the passage says how much time passed, use the amount it names rather than your own estimate.
- When no time passes at all, the count is zero.`;
const parseSchema = (reply, start) => {
  try {
    const j = JSON.parse(reply);
    if (j.ends_at in ANCHOR_HOURS) { const d = (ANCHOR_HOURS[j.ends_at] - start + 24) % 24; return d === 0 ? 24 : d; }
    return Number.isInteger(j.count) && j.unit in SCHEMA_UNITS ? j.count * SCHEMA_UNITS[j.unit] : null;
  } catch { return null; }
};

// Schema v2: the unit before the count, an anchor that means "runs until", and whole days that carry
// past the anchor (a four-day journey reaching a morning, a scene ending the next morning).
const SCHEMA2_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "time_passed", strict: true,
    schema: {
      type: "object", additionalProperties: false, required: ["lasts_until", "unit", "count"],
      properties: {
        lasts_until: { type: "string", enum: ["none", ...Object.keys(ANCHOR_HOURS)] },
        unit: { type: "string", enum: Object.keys(SCHEMA_UNITS) },
        count: { type: "integer", minimum: 0 },
      },
    },
  },
};
const SCHEMA2_SYS = `You measure how much time passes in a story. You are given what the character did and what happened next.

Answer with three fields:
- lasts_until: when the passage runs on until a time of day it shows or names, that time of day. Otherwise none. The time of day the scene happens at is not enough on its own.
- unit and count: how long it took. Choose the unit first - ${Object.keys(SCHEMA_UNITS).join(", ")} - then the whole number of that unit.

- A brief exchange, a glance, a few words traded: some number of minutes.
- A conversation, a walk across town, a meal, a night's sleep, a task seen through: some number of hours.
- An overland journey, a long convalescence, a season of training: some number of days or weeks.
- When the passage says how much time passed, use the amount it names rather than your own estimate.
- When no time passes at all, the count is zero.`;
const parseSchema2 = (reply, start) => {
  try {
    const j = JSON.parse(reply);
    const counted = Number.isInteger(j.count) && j.unit in SCHEMA_UNITS ? j.count * SCHEMA_UNITS[j.unit] : null;
    if (!(j.lasts_until in ANCHOR_HOURS)) return counted;
    const d = (ANCHOR_HOURS[j.lasts_until] - start + 24) % 24 || 24;
    // An anchor just behind the start names the time it already is: trust a sub-day count instead.
    if (d > 20 && counted !== null && counted < 24) return counted;
    const days = counted === null ? 0 : Math.floor(counted / 24);
    return d + Math.max(0, days - 1) * 24;
  } catch { return null; }
};

// Schema v3: v2 with units largest first, the stated-amount rule inside the unit line, and an anchor
// that needs the passage to show the time of day arriving.
const SCHEMA3_UNITS = ["weeks", "days", "hours", "minutes"];
const SCHEMA3_FORMAT = {
  ...SCHEMA2_FORMAT,
  json_schema: {
    ...SCHEMA2_FORMAT.json_schema,
    schema: {
      ...SCHEMA2_FORMAT.json_schema.schema,
      properties: { ...SCHEMA2_FORMAT.json_schema.schema.properties, unit: { type: "string", enum: SCHEMA3_UNITS } },
    },
  },
};
const SCHEMA3_SYS = `You measure how much time passes in a story. You are given what the character did and what happened next.

Answer with three fields:
- lasts_until: when the passage shows a time of day arriving and the scene running on until it, that time of day. Otherwise none. The time of day the scene happens at is not enough on its own.
- unit: ${SCHEMA3_UNITS.join(", ")}. When the passage names how much time passed, use the unit it names.
- count: the whole number of that unit. When the passage names how much time passed, use the number it names. Zero means no time passed at all.

- A brief exchange, a glance, a few words traded: some number of minutes.
- A conversation, a walk across town, a meal, a night's sleep, a task seen through: some number of hours.
- An overland journey, a long convalescence, a season of training: some number of days or weeks.`;

const SYSTEMS = { anchor: ANCHOR_SYS, schema: SCHEMA_SYS, schema2: SCHEMA2_SYS, schema3: SCHEMA3_SYS };
const FORMATS = { schema: SCHEMA_FORMAT, schema2: SCHEMA2_FORMAT, schema3: SCHEMA3_FORMAT };
const sysFor = (arm) => SYSTEMS[arm] ?? SYS;
const parseFor = (arm, reply, c) =>
  arm === "anchor" ? parseAnchor(reply, c.start) : arm === "schema" ? parseSchema(reply, c.start)
    : arm === "schema2" || arm === "schema3" ? parseSchema2(reply, c.start) : clock.parseTimeDelta(reply);
const callFor = (arm) => (FORMATS[arm] ? { ...opts, temp: 0, maxTokens: 60, extra: { response_format: FORMATS[arm] } } : { ...opts, temp: 0, maxTokens: 12 });

if (SHOW_PROMPT) { for (const arm of ARMS) console.log(`--- ${arm}\n${sysFor(arm)}\n\n${userFor(cases[0], arm)}\n`); process.exit(0); }
console.log(`arms ${ARMS.join(", ")} · ${cases.length} cases · model ${opts.model} · runs ${opts.runs} · temp 0 (the app's timePassed pin)\n`);
await callMessages({ ...opts, temp: 0, maxTokens: 4 }, [{ role: "user", content: "ping" }]).catch(() => {});

const score = Object.fromEntries(ARMS.map((a) => [a, { hit: 0, total: 0, unparseable: 0, anchHit: 0, anchTotal: 0 }]));
let flatHit = 0, flatTotal = 0;
for (const c of cases) {
  const got = Object.fromEntries(ARMS.map((a) => [a, []]));
  for (let r = 0; r < opts.runs; r++) {
    for (const arm of ARMS) {
      const reply = await callMessages(callFor(arm), [
        { role: "system", content: sysFor(arm) },
        { role: "user", content: userFor(c, arm) },
      ]);
      const hours = parseFor(arm, reply, c);
      const s = score[arm];
      s.total++;
      if (hours === null) s.unparseable++;
      if (inRange(hours, c)) s.hit++;
      if (c.id.startsWith("anchor-")) { s.anchTotal++; if (inRange(hours, c)) s.anchHit++; }
      got[arm].push(hours);
      if (VERBOSE) console.log(`    ${c.id}#${r + 1} ${arm} "${reply.replace(/\s+/g, " ").slice(0, 80)}" -> ${hours === null ? "unparseable" : fmt(hours)}`);
    }
  }
  // The flat hour scored against the same range, once per run, so the comparison is like-for-like.
  flatTotal += opts.runs;
  if (inRange(clock.FLAT_HOURS_PER_TURN, c)) flatHit += opts.runs;
  console.log(`${c.id.padEnd(16)} start ${String(c.start).padStart(2, "0")}:00  want ${fmt(c.min)}..${fmt(c.max)}`);
  for (const arm of ARMS) {
    const ok = got[arm].filter((h) => inRange(h, c)).length;
    const shown = got[arm].map((h) => (h === null ? "??" : fmt(h))).join(" ");
    console.log(`  ${ok === opts.runs ? "OK  " : ok === 0 ? "MISS" : "part"} ${arm.padEnd(8)} ${ok}/${opts.runs}  ${shown}`);
  }
}

const pct = (n, d) => `${Math.round((n / Math.max(1, d)) * 100)}%`;
console.log("");
for (const arm of ARMS) {
  const s = score[arm];
  console.log(`${arm.padEnd(8)} in range ${pct(s.hit, s.total)} (${s.hit}/${s.total}) · anchored ${pct(s.anchHit, s.anchTotal)} (${s.anchHit}/${s.anchTotal}) · unanchored ${pct(s.hit - s.anchHit, s.total - s.anchTotal)} · unparseable ${pct(s.unparseable, s.total)}`);
}
console.log(`flat 1h  in range ${pct(flatHit, flatTotal)} (${flatHit}/${flatTotal})  <- the baseline it has to beat`);
