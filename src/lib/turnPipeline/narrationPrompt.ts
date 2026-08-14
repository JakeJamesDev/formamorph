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
import { renderPromptTemplate } from "../promptTemplate";
import { restyle } from "../sectionStyle";
import type { SectionStyle } from "../promptPresets";
import { markdownGuidance } from "../../components/game/GamePrompts";
import { lengthGuidance, type ParagraphLimit } from "../outputLength";
import { NONE_PLACEHOLDER } from "../promptFallbacks";

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
  playerNotes: string;
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
 * The scan corpus is exactly the context the AI is given — whichever location/entity blocks this prompt
 * renders, in their rendered form — so anything the model can read can fire a trigger, and nothing it can't.
 * Always-present scaffolding (world description, stats/traits, guidance) is excluded; see `buildScanCorpus`.
 * History honors each entry's `scanDepth`.
 */
export function buildNarrationPrompt(input: NarrationPromptInput): NarrationPromptResult {
  const {
    template, ctx, action, playerNotes, history, dictionary, actionVec, semanticLore,
    embedVectors, language, paragraphLimit, maxTokens, markdownOutput, sectionStyle, resolvePH,
  } = input;

  const dictCorpus = buildScanCorpus({
    template,
    ctx,
    action,
    // The prompt shows the resolved <NOTES> chip, or the raw fallback section when it has no chip.
    notes: template.includes("<NOTES>") ? ctx["<NOTES>"] : playerNotes,
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
  // Split by position into the two lorebook blocks. When the active prompt has no "before" chip, those entries
  // fall back into the single "after" block so no lore is lost; a prompt with no dictionary chip at all gets a
  // code append below (as before the chips existed).
  const hasBeforeChip = template.includes("<DICTIONARY|before>");
  const hasAfterChip = template.includes("<DICTIONARY>");
  const beforeEntries = hasBeforeChip ? activatedEntries.filter((e) => e.position === "before") : [];
  const afterEntries = activatedEntries.filter((e) => !beforeEntries.includes(e));

  // Code-generated blocks (markdown guidance, notes fallback, dictionary) are authored in markdown, so
  // restyle them to the active preset's section style to match the authored prompt's headers.
  let prompt = renderPromptTemplate(template, {
    ...ctx,
    "<LENGTH GUIDANCE>": lengthGuidance(paragraphLimit, maxTokens),
    "<MARKDOWN GUIDANCE>": restyle(markdownGuidance(markdownOutput), sectionStyle),
    "<DICTIONARY>": resolvePH(buildDictionaryContext(afterEntries, false)) || NONE_PLACEHOLDER,
    "<DICTIONARY|before>": resolvePH(buildDictionaryContext(beforeEntries, false)) || NONE_PLACEHOLDER,
  });

  // If the prompt has no <NOTES> chip, fall back to a notes section before the location data.
  if (!template.includes("<NOTES>")) {
    const notesSection = restyle(`
## Player Notes
${playerNotes || NONE_PLACEHOLDER}

`, sectionStyle);
    // Locate the location header in whichever style the active prompt uses.
    const locationIndex = prompt.search(/^#{0,6}[ \t]*Current Location:?/mi);
    if (locationIndex !== -1) {
      prompt = prompt.slice(0, locationIndex) + notesSection + prompt.slice(locationIndex);
    }
  }

  if (language.toLowerCase() != "english") prompt += `\n Narration language: ` + language;

  // Backward-compat: a prompt with no "after" dictionary chip still gets its lore appended (with heading), as
  // it was before the chip existed. (A missing "before" chip already routed those entries into `afterEntries`.)
  if (!hasAfterChip) {
    const dictionaryContext = resolvePH(buildDictionaryContext(afterEntries));
    if (dictionaryContext) prompt += `\n\n${restyle(dictionaryContext, sectionStyle)}`;
  }

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
