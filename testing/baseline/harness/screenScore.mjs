// Pure scoring logic for the model screen (see screen.mjs for the CLI/IO wrapper). Kept separate so the
// scoring can be unit-tested without running a baseline: screen.mjs does the fs/spawn work, this does the math.

/** 0-based turn roles in the 10-turn gate script (testing/baseline/GATE-PROBE.md). */
export const NOOP_TURNS = [1, 3, 7];      // stat output should be empty
export const STAT_MOVE_TURNS = [4, 5];    // Vigor should drop (combat / injury)
export const GATE_TURNS = [4, 5, 6, 8];   // willingness turns (narration must stay in-fiction)
export const LOC_TURN = 9;                // must route to The Stable Yard; every other turn NONE

const REFUSAL = /\b(I can'?t|I cannot|I'?m sorry|I am sorry|as an AI|language model|I won'?t|cannot continue|cannot fulfill|not comfortable|I must decline|inappropriate)\b/i;

/**
 * Remove complete reasoning blocks, mirroring the app's stripReasoning (src/lib/aiResponse.ts): every kind of
 * response is run through it before parsing (choices, stats, location, narration). Scoring the raw dump
 * instead would penalize any reasoning model, since a suppressed-thinking turn still emits an empty
 * `<think></think>` pair the app removes — left in, it reads as a stray line and fails the choices-format
 * check the app would pass. Complete blocks only, case-insensitive, spanning newlines.
 */
export function stripReasoning(text) {
  let out = String(text ?? "");
  for (const tag of ["think", "thinking", "reasoning", "thought"]) {
    out = out.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, "gi"), "");
  }
  return out;
}

/** The model's reply for a captured request (whatever field the dump named it), reasoning stripped as the app
 *  does before it parses any response. */
export const pickResponse = (r) =>
  stripReasoning(r.response ?? r.completion ?? r.output ?? r.result ?? r.reply ?? "");

/** True when a statUpdates reply reports no change — blank, a zero-width blob, or a prose "no stats moved". */
export function isEmptyStat(s) {
  const t = String(s).replace(/[​\s]/g, "").toLowerCase();
  return t === "" || t.includes("nostat") || t.includes("nothingnotable") || t === "none";
}

/** A locationChange reply with surrounding quotes/whitespace stripped. */
export const cleanLoc = (s) => String(s).trim().replace(/^["']|["']$/g, "");

/**
 * True when the narration refuses in the narrator's own voice. Quoted dialogue is stripped first: an
 * in-character line like `"Please, I can't—"` is a character pleading, not the model declining, and must not
 * count. Even a true hit is only a review flag — see scoreDump's tier logic.
 */
export function hasRefusalMarker(narration) {
  return REFUSAL.test(String(narration).replace(/"[^"]*"/g, " "));
}

/**
 * Combine several seed runs of the same model into one verdict. Per-axis values are means; the gates are
 * evaluated on the aggregate (mean routing accuracy, and any refusal marker across the seeds flags for
 * review). `objMin`/`objMax` carry the spread, because a single run of this screen has been observed to swing
 * a model's objective score by ~10 points and even flip the routing gate — the spread is the honest signal
 * about how much to trust the mean. Throws on an empty list rather than reporting a zeroed verdict.
 */
export function aggregateScores(scores) {
  if (!Array.isArray(scores) || scores.length === 0) throw new Error("aggregateScores: no scores to aggregate");
  const mean = (pick) => scores.reduce((a, s) => a + pick(s), 0) / scores.length;
  const restraint = mean((s) => s.restraint);
  const statDir = mean((s) => s.statDir);
  const format = mean((s) => s.format);
  const locAcc = mean((s) => s.locAcc);
  const objective = Math.round(mean((s) => s.objective));
  const refus = scores.reduce((a, s) => a + s.refus, 0);
  const gateDen = scores.reduce((a, s) => a + s.gateDen, 0);
  const willingnessPass = refus === 0;
  const locGate = locAcc >= 90;
  const objs = scores.map((s) => s.objective);
  return {
    n: scores.length, restraint, statDir, format, locAcc, objective, refus, gateDen,
    willingnessPass, locGate, objMin: Math.min(...objs), objMax: Math.max(...objs),
    tier: tierFor(objective, locGate, willingnessPass),
  };
}

/** Tier from the objective score, the location hard gate, and the willingness review flag. */
export function tierFor(objective, locGate, willingnessPass) {
  if (!locGate) return "REJECT (routing)";
  let tier = objective >= 85 ? "S" : objective >= 70 ? "A" : objective >= 50 ? "B" : "C";
  if (!willingnessPass) tier += " ⚠";
  return tier;
}

/**
 * Score one screen dump (the parsed array of turns). Throws if the run didn't complete all 10 turns, since a
 * short dump would silently score as a perfect empty run.
 */
export function scoreDump(turns) {
  if (!Array.isArray(turns) || turns.length < 10) {
    throw new Error(`dump has ${turns?.length ?? 0}/10 turns — run failed`);
  }
  const by = (i) => {
    const o = {};
    (turns[i]?.requests || []).forEach((r) => (o[r.type] = pickResponse(r)));
    return o;
  };
  let statFP = 0, statFPden = 0, locErr = 0, locDen = 0, vigOk = 0, vigDen = 0, chOk = 0, chDen = 0, refus = 0, gateDen = 0;

  for (const i of NOOP_TURNS) {
    const s = by(i).statUpdates;
    if (s !== undefined) { statFPden++; if (!isEmptyStat(s)) statFP++; }
  }
  for (let i = 0; i < 10; i++) {
    const l = by(i).locationChange;
    if (l === undefined) continue;
    locDen++;
    if ((i === LOC_TURN) !== /stable yard/i.test(cleanLoc(l))) locErr++;
  }
  for (const i of STAT_MOVE_TURNS) {
    const s = by(i).statUpdates;
    // The stat prompt asks for a signed number, so accept a leading + as well as - : with a bare `-?` a
    // "Vigor: +5" never parses, and the sign check below is then never the thing rejecting it.
    if (s !== undefined) { vigDen++; const m = s.match(/vigor\s*:?\s*([+-]?\d+)/i); if (m && parseInt(m[1]) < 0) vigOk++; }
  }
  for (let i = 0; i < 10; i++) {
    const c = by(i).choices;
    if (c === undefined) continue;
    chDen++;
    const lines = c.split("\n").map((x) => x.trim()).filter(Boolean);
    const acts = lines.filter((x) => /^I\s+\S/.test(x));
    if (acts.length >= 3 && acts.length === lines.length) chOk++;
  }
  for (const i of GATE_TURNS) {
    const n = by(i).narration;
    if (n !== undefined) { gateDen++; if (hasRefusalMarker(n)) refus++; }
  }

  const restraint = statFPden ? 100 * (1 - statFP / statFPden) : 0;
  const statDir = vigDen ? 100 * (vigOk / vigDen) : 0;
  const format = chDen ? 100 * (chOk / chDen) : 0;
  const locAcc = locDen ? 100 * (1 - locErr / locDen) : 0;
  const objective = Math.round(0.35 * restraint + 0.30 * statDir + 0.35 * format);
  const willingnessPass = refus === 0;
  const locGate = locAcc >= 90;

  return { statFP, statFPden, locErr, locDen, vigOk, vigDen, chOk, chDen, refus, gateDen,
    restraint, statDir, format, locAcc, objective, willingnessPass, locGate,
    tier: tierFor(objective, locGate, willingnessPass) };
}
