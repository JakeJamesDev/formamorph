import type { ChatMessage } from "@/types";
import type { DictionaryEntry } from "@/types/world";
import { buildScanCorpus } from "../dictionaryScan";
import {
  explainActivation,
  buildDictionaryContext,
  type EntryActivation,
  type ScanSource,
} from "../dictionaryUtils";
import { selectSemanticLore, applySemanticLore } from "../semanticDictionary";
import { renderPromptTemplate, parsePromptTemplate } from "../promptTemplate";
import { splitToken } from "../promptVariables";
import { restyle } from "../sectionStyle";
import type { SectionStyle } from "../promptPresets";
import { markdownGuidance } from "../../components/game/GamePrompts";
import { lengthGuidance, type ParagraphLimit } from "../outputLength";
import { NONE_PLACEHOLDER } from "../promptFallbacks";
import { languageDirective } from "../languages";

/**
 * Which chips a template carries, as the affix-free tokens the value map is keyed by (`<NOTES>`,
 * `<DICTIONARY|before>`).
 *
 * Read through the parser rather than by substring: a placement with a prefix or suffix
 * (`<NOTES|pre="Remember: ">`) renders its value like any other, so a raw `includes("<NOTES>")` would call
 * the chip absent and then withhold the notes from the lore scan they are visibly part of.
 */
function chipKeys(template: string): Set<string> {
  return new Set(
    parsePromptTemplate(template).flatMap((s) =>
      s.type === "variable" ? [splitToken(s.token)?.key ?? s.token] : [],
    ),
  );
}

/** The per-entry activation report plus the verbatim scanned strings a hit landed in. */
export interface DictionaryDebug {
  report: EntryActivation[];
  sources: ScanSource[];
}

export interface NarrationPromptInput {
  /** The active narration prompt, chips unresolved. */
  template: string;
  /** The shared context values this turn's location produced. */
  ctx: Record<string, string>;
  action: string;
  history: ChatMessage[];
  dictionary: DictionaryEntry[];
  /** This turn's action embedding, or null when no semantic feature is live. */
  actionVec: Float32Array | null;
  semanticLore: boolean;
  embedVectors: Map<string, Float32Array>;
  language: string;
  paragraphLimit: ParagraphLimit;
  maxTokens: number;
  markdownOutput: boolean;
  sectionStyle: SectionStyle;
  /** Placeholder resolution, which depends on this playthrough's rolled values. */
  resolvePH: (text: string) => string;
}

export interface NarrationPromptResult {
  prompt: string;
  dictionaryDebug: DictionaryDebug;
}

/**
 * Assemble the narration system prompt for one turn, and the AI-context record of what lore fired.
 *
 * The template is the whole prompt: every block comes from a chip the author placed, and a chip they
 * deleted injects nothing anywhere. Nothing is appended after the render, so reading the template tells
 * you the payload.
 *
 * The scan corpus is exactly the context the AI is given — whichever location/entity blocks this prompt
 * renders, in their rendered form — so anything the model can read can fire a trigger, and nothing it can't.
 * Always-present scaffolding (world description, stats/traits, guidance) is excluded; see `buildScanCorpus`.
 * History honors each entry's `scanDepth`.
 */
export function buildNarrationPrompt(input: NarrationPromptInput): NarrationPromptResult {
  const {
    template, ctx, action, history, dictionary, actionVec, semanticLore,
    embedVectors, language, paragraphLimit, maxTokens, markdownOutput, sectionStyle, resolvePH,
  } = input;

  const chips = chipKeys(template);
  const dictCorpus = buildScanCorpus({
    template,
    ctx,
    action,
    // Notes reach the model only through their chip, so a prompt without one has no notes to scan.
    notes: chips.has("<NOTES>") ? ctx["<NOTES>"] ?? "" : "",
    history,
  });
  const activationReport = explainActivation(dictionary, dictCorpus.scene, { history: dictCorpus.history });
  if (semanticLore && actionVec) {
    // Additive meaning-based activations; a keyword reason always wins (see lib/semanticDictionary).
    applySemanticLore(activationReport, selectSemanticLore(dictionary, actionVec, embedVectors));
  }
  const activatedEntries = dictionary.filter(
    (e) => e.enabled !== false && activationReport.byId.get(e.id)?.activated,
  );
  // Split by position into the two lorebook blocks. Where the author kept only one dictionary chip, the
  // entries positioned for the missing one flow into the chip that remains — an entry's position is world
  // data, not prompt authorship, so lore vanishes only when every dictionary chip is gone.
  const hasBeforeChip = chips.has("<DICTIONARY|before>");
  const hasAfterChip = chips.has("<DICTIONARY>");
  const beforeEntries = hasBeforeChip
    ? (hasAfterChip ? activatedEntries.filter((e) => e.position === "before") : activatedEntries)
    : [];
  const afterEntries = hasAfterChip ? activatedEntries.filter((e) => !beforeEntries.includes(e)) : [];

  // The markdown guidance is a code-generated block authored in markdown, so it is restyled to the active
  // preset's section style to match the authored prompt's headers; the lore blocks carry no headers of their
  // own and need none. Trailing whitespace goes, so a trailing chip that resolves to nothing — the language
  // chip on an English game — leaves no dangling blank lines behind it.
  const prompt = renderPromptTemplate(template, {
    ...ctx,
    "<LENGTH GUIDANCE>": lengthGuidance(paragraphLimit, maxTokens),
    "<MARKDOWN GUIDANCE>": restyle(markdownGuidance(markdownOutput), sectionStyle),
    "<DICTIONARY>": resolvePH(buildDictionaryContext(afterEntries, false)) || NONE_PLACEHOLDER,
    "<DICTIONARY|before>": resolvePH(buildDictionaryContext(beforeEntries, false)) || NONE_PLACEHOLDER,
    "<LANGUAGE>": languageDirective("narration", language),
  }).trimEnd();

  // AI-context capture. Every scanned source is a string the prompt genuinely contains, so the viewer can
  // locate each match directly — no re-derivation, and the highlights cannot drift from what activated.
  // Recursion hits point at an active entry's value, which the injected lore block shows verbatim.
  const report = activationReport.entries;
  const recursionSources: ScanSource[] = activatedEntries
    .filter((e) => e.value)
    .map((e) => ({ region: `recursion:${e.id}`, text: e.value }));
  // Keep only the scanned strings a hit actually landed in, so the debug/export JSON stays lean.
  const hitRegions = new Set(report.flatMap((e) => e.hits.map((h) => h.region)));
  const sources = [...dictCorpus.scene, ...dictCorpus.history, ...recursionSources]
    .filter((s) => hitRegions.has(s.region));

  return { prompt, dictionaryDebug: { report, sources } };
}
