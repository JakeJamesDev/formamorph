// Freeze-fix A/B candidates for the dialogue-collapse investigation. Each entry is a named edit applied to the
// LIVE shipped prompts (grabbed from GamePrompts.ts) so A = shipped (no edit) and B = shipped + edit. Every edit
// asserts its exact target substring exists and throws if the prompt has drifted, so a stale candidate fails
// loud instead of silently no-op'ing. Methodology: positive output contract, fold into an existing bullet (no
// new bullet - length hurts small models), no parrotable example phrases. Target: charged-ambient freeze down +
// dialogue up, guarded by baited 100% + broad not regressing.

function swap(text, find, replace, label) {
  if (!text.includes(find)) throw new Error(`[${label}] edit target not found (prompt drifted?):\n${find}`);
  return text.replace(find, replace);
}

// The shipped "characters speak" bullet (narration prompt, defaultSystemPrompt).
const NARR_SPEAK =
  "- When characters are present, they speak - render their actual spoken words as quoted dialogue, not a summary of what they say. Let real conversation carry the scene where it fits, rather than narrating around silent figures.";

export const FIXES = {
  // B1 — narration register contract: keep the same rule, extend it to name the exact place it breaks (charged /
  // quiet / intimate beats) and reassert forward motion + voiced dialogue there. Positive-dominant.
  register: {
    label: "register",
    apply({ narr, think }) {
      const narrFixed = swap(
        narr,
        NARR_SPEAK,
        "- When characters are present, they speak - render their actual spoken words as quoted dialogue, not a summary of what they say. This holds hardest in charged, quiet, or intimate moments, where it is tempting to slip into wordless stillness: there especially, the characters still voice what they feel and want, and the scene still takes one concrete step forward. A hushed, breath-held tableau is a single beat within the turn, never the whole of it.",
        "register",
      );
      return { narr: narrFixed, think };
    },
  },

  // B2 — purely positive: same target bullet, but NO anti-pattern vocabulary at all (B1's "stillness / breath-
  // held tableau" got parroted and drove freeze UP). Assert only the wanted behavior: voice desire in spoken
  // words + move one concrete step, hardest exactly in the charged/quiet moments.
  positive: {
    label: "positive",
    apply({ narr, think }) {
      const narrFixed = swap(
        narr,
        NARR_SPEAK,
        "- When characters are present, they speak - render their actual spoken words as quoted dialogue, not a summary of what they say. Charged, quiet, and intimate moments are where their voices matter most: let each present character put what they feel and want into spoken words, and carry the scene one concrete step further this turn.",
        "positive",
      );
      return { narr: narrFixed, think };
    },
  },
};

export function applyFix(name, prompts) {
  if (!name || name === "shipped") return prompts;
  const fix = FIXES[name];
  if (!fix) throw new Error(`unknown --fix "${name}" (have: ${Object.keys(FIXES).join(", ")}, shipped)`);
  return fix.apply(prompts);
}
