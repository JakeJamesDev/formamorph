/**
 * Detects whether a world holds anything Simple mode hides, so the World Editor can say so beside the
 * mode switch. Mirrors the hidden surfaces in `docs-internal/designs/world-editor-simple-mode/design.md`: the two
 * hidden tabs, and every Advanced-only field.
 */
import { hasValue } from './editorMode';
import { allPlaceholders } from './placeholderHomes';
import { storedOpeningCue } from './openingCue';
import { storedWorldPrompt, WORLD_PROMPT_KINDS } from './worldPrompt';
import type { Dictionary, Entity, GameLocation, Placeholder, Stat, Trait, WorldOverview } from '@/types';

export interface AdvancedDataInput {
  worldOverview: WorldOverview;
  stats: Stat[];
  entities: Entity[];
  locations: GameLocation[];
  traits: Trait[];
  dictionaries: Dictionary[];
  placeholders: Placeholder[];
}

/**
 * Whether `w` holds anything Simple mode hides. Collections read as `?? []`: hand-edited world JSON can
 * omit any of them, and a world with nothing to look through hides nothing.
 */
export function worldUsesAdvancedFeatures(w: AdvancedDataInput): boolean {
  if (allPlaceholders(w).length > 0) return true;
  // The Dictionary tab itself is visible in Simple, so only the parts of it Simple can't show count:
  // an entry using a hidden option, or anything muted (the enable toggles are Advanced-only).
  if ((w.dictionaries ?? []).some((d) => d.enabled === false || (d.entries ?? []).some((e) =>
    e.enabled === false || e.constant || e.useRegex || e.recursive ||
    hasValue(e.scanDepth) || hasValue(e.secondaryKeys)))) return true;
  if (WORLD_PROMPT_KINDS.some((kind) => hasValue(storedWorldPrompt(w.worldOverview, kind)))) return true;
  if (hasValue(storedOpeningCue(w.worldOverview))) return true;
  if ((w.stats ?? []).some((s) =>
    hasValue(s.code) || hasValue(s.descriptors) ||
    s.noIncrease || s.noIncreaseMax || s.noDecrease || s.noDecreaseMax)) return true;
  if ((w.entities ?? []).some((e) =>
    hasValue(e.aliases) || hasValue(e.aiSummary) || hasValue(e.type) || hasValue(e.model) ||
    hasValue(e.imageTags))) return true;
  if ((w.locations ?? []).some((l) => hasValue(l.aiSummary) || hasValue(l.ambientSound) || hasValue(l.imageTags))) return true;
  if ((w.traits ?? []).some((t) => hasValue(t.statToggles) || hasValue(t.placeholderPins))) return true;
  return false;
}
