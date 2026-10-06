/**
 * Detects whether a world holds anything Simple mode hides, so the World Editor can say so beside the
 * mode switch. Mirrors the hidden surfaces in `docs-internal/designs/world-editor-simple-mode/design.md`: the two
 * hidden tabs, and every Advanced-only field.
 */
import { hasValue } from './editorMode';
import { memoByRecord } from './memoByRecord';
import { allPlaceholders } from './placeholderHomes';
import { openingTexts } from './openings';
import { worldAllowedPersonas, worldStartPersona } from './personaPick';
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

// The Dictionary tab itself is visible in Simple, so only the parts of it Simple can't show count:
// an entry using a hidden option, or anything muted (the enable toggles are Advanced-only).
const bookIsAdvanced = memoByRecord((d: Dictionary) => d.enabled === false || (d.entries ?? []).some((e) =>
  e.enabled === false || e.constant || e.useRegex || e.recursive ||
  hasValue(e.scanDepth) || hasValue(e.secondaryKeys)));
const overviewIsAdvanced = memoByRecord((ov: WorldOverview) =>
  WORLD_PROMPT_KINDS.some((kind) => hasValue(storedWorldPrompt(ov, kind))) ||
  openingTexts(ov).length > 0 ||
  worldAllowedPersonas(ov) !== 'any' || !!worldStartPersona(ov));
const statIsAdvanced = memoByRecord((s: Stat) =>
  hasValue(s.beforeCode) || hasValue(s.code) || hasValue(s.descriptors) ||
  !!(s.noIncrease || s.noIncreaseMax || s.noDecrease || s.noDecreaseMax));
const entityIsAdvanced = memoByRecord((e: Entity) =>
  !!e.persona || hasValue(e.aliases) || hasValue(e.aiSummary) || hasValue(e.type) || hasValue(e.model) ||
  hasValue(e.imageTags) || openingTexts(e).length > 0);
const locationIsAdvanced = memoByRecord((l: GameLocation) =>
  hasValue(l.aiSummary) || hasValue(l.ambientSound) || hasValue(l.imageTags) || openingTexts(l).length > 0);
const traitIsAdvanced = memoByRecord((t: Trait) => hasValue(t.statToggles) || hasValue(t.placeholderPins));

/**
 * Whether `w` holds anything Simple mode hides. Collections read as `?? []`: hand-edited world JSON can
 * omit any of them, and a world with nothing to look through hides nothing.
 */
export function worldUsesAdvancedFeatures(w: AdvancedDataInput): boolean {
  if (allPlaceholders(w).length > 0) return true;
  if ((w.dictionaries ?? []).some(bookIsAdvanced)) return true;
  if (w.worldOverview && overviewIsAdvanced(w.worldOverview)) return true;
  if ((w.stats ?? []).some(statIsAdvanced)) return true;
  if ((w.entities ?? []).some(entityIsAdvanced)) return true;
  if ((w.locations ?? []).some(locationIsAdvanced)) return true;
  if ((w.traits ?? []).some(traitIsAdvanced)) return true;
  return false;
}
