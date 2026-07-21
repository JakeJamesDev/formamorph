import { parsePromptTemplate } from './promptTemplate';
import { parseTurnContent } from './turnDigest';
import type { ScanSource } from './dictionaryUtils';
import type { ChatMessage } from '@/types';

/**
 * Which context blocks the dictionary scans. The rule: **if the AI is given the text, the text can fire a
 * trigger** — no hidden withholding. So the scanned corpus is built from the blocks the prompt actually
 * renders, in their rendered form (a chip set to `summary` is scanned as its summary, because that is what
 * the model was told).
 *
 * The one exception is always-present scaffolding — the world description, the authored prompt body, the
 * generated guidance blocks, and the stat/trait rosters. Their text repeats every turn, so keywords on them
 * would fire permanently: noise rather than signal. Lore triggering other lore stays opt-in per entry
 * (`recursive`), so a cascade is always the author's explicit choice.
 */

/** Token bases whose rendered blocks are scanned; every variant of these is in scope. */
const SCANNED_BASES = ['<LOCATION>', '<ENTITIES>'];

/** Whether a token is one of the scanned scene blocks (any variant). */
function isScannedSceneToken(token: string): boolean {
  return SCANNED_BASES.some((base) => token === base || token.startsWith(`${base.slice(0, -1)}|`));
}

/** The text of one history message as the AI receives it: an assistant turn's narration rather than the
 *  stored JSON envelope (so JSON field names and ids can never trigger an entry). */
export function scannableMessageText(message: ChatMessage): string {
  if (message.role !== 'assistant') return message.content;
  const parsed = parseTurnContent(message.content);
  return parsed?.narration ?? message.content;
}

/** Inputs for `buildScanCorpus`. */
export interface ScanCorpusInput {
  /** The active system-prompt template, before rendering — decides which blocks are in scope. */
  template: string;
  /** Rendered chip values by token (the same map handed to `renderPromptTemplate`). */
  ctx: Record<string, string>;
  /** The player's action for this turn, as sent. */
  action: string;
  /** Player notes as rendered: the resolved `<NOTES>` chip, or the raw fallback section's text. */
  notes: string;
  /** Full message history, oldest→newest; `scanDepth` still limits the lookback per entry. */
  history: ChatMessage[];
}

/** The scene + history halves of the corpus, ready for `explainActivation`. */
export interface ScanCorpus {
  /** Always scanned: the rendered location/entity blocks, the action, and player notes. */
  scene: ScanSource[];
  /** Scanned per entry up to its `scanDepth`. */
  history: ScanSource[];
}

/**
 * Build the turn's scan corpus — the single construction shared by activation and the AI-context viewer.
 * Because every source is a string the prompt genuinely contains, the viewer can locate each match instead
 * of guessing, and the two can never drift apart. Scene regions are labeled with the token that produced
 * them (e.g. `<ENTITIES|reachable.summary.markdown>`); history regions are `history:<index>`.
 */
export function buildScanCorpus({ template, ctx, action, notes, history }: ScanCorpusInput): ScanCorpus {
  const seen = new Set<string>();
  const scene: ScanSource[] = [];
  for (const segment of parsePromptTemplate(template)) {
    if (segment.type !== 'variable' || !isScannedSceneToken(segment.token) || seen.has(segment.token)) continue;
    seen.add(segment.token);
    const text = ctx[segment.token];
    if (text) scene.push({ region: segment.token, text });
  }
  if (action) scene.push({ region: 'action', text: action });
  if (notes) scene.push({ region: 'notes', text: notes });
  return {
    scene,
    history: history.map((m, i) => ({ region: `history:${i}`, text: scannableMessageText(m) })),
  };
}
