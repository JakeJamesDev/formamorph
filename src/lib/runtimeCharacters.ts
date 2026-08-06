import { randomUUID } from "@/lib/uuid";
import type { ChatMessage, Entity, GameLocation, DiscoveredEntity } from '@/types';
import { parseTurnContent } from '@/lib/turnDigest';
import { stripReasoning } from '@/lib/aiResponse';
import { trimToLastSentence } from '@/lib/outputLength';
import { escapeRegExp } from '@/lib/utils';
import { sameCharacterName } from '@/lib/entityMatch';

/** Labels in the discover-entity user message. Exported so the request builder and the response
 *  cleaner share one source of truth — a small model often parrots these back into its output. */
export const DISCOVER_NAME_LABEL = 'Character name:';
export const DISCOVER_PASSAGE_LABEL = 'The passage they appeared in:';

/**
 * Pure helpers for "runtime characters" (Slice 2): promoting a director-invented ad-hoc character that
 * the narration confirmed into a persisted, per-playthrough `Entity`. Deterministic and unit-testable —
 * the idle drainer in GameViewer wires these to a silent describe request + `discoveredEntities` state.
 */

/** One turn's participant that isn't backed by any known (authored or already-discovered) entity. */
export interface DueDiscovery {
  turnId: string;
  name: string;
  narration: string;
  locationId?: string;
}

/**
 * The newest committed turn holding a participant name not already accounted for by `knownNames`
 * (authored + already-discovered names), or `null` when everything is covered. A participant counts as
 * known when `sameCharacterName` matches any known name, so a variant ("Aldric" of "Sergeant Aldric")
 * doesn't spawn a duplicate entity. Newest-first so a freshly invented character materializes on the
 * next idle tick; self-terminating once its name joins the known set.
 */
export function selectDueDiscovery(history: ChatMessage[], knownNames: string[]): DueDiscovery | null {
  const isKnown = (n: string) => knownNames.some((k) => sameCharacterName(n, k));
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    if (message.role !== 'assistant') continue;
    const turn = parseTurnContent(message.content);
    if (!turn?.turnId || !turn.narration?.trim() || !turn.entities?.length) continue;
    const name = turn.entities.find((n) => n.trim() && !isKnown(n));
    if (name) {
      return { turnId: turn.turnId, name, narration: turn.narration, locationId: turn.locationId };
    }
  }
  return null;
}

/** Build a minimal valid runtime `Entity` from a coined name and a generated AI-facing description. */
export function materializeDiscoveredEntity(name: string, aiDescription: string): Entity {
  return { id: randomUUID(), name: name.trim(), aiDescription: aiDescription.trim() };
}

/**
 * Sanitize a raw discover-entity response into a durable description. Small models over-generate past
 * the description and parrot the user-message labels (then hallucinate more), or get token-capped
 * mid-word — so drop reasoning blocks, cut anything from an echoed label onward, strip a leading
 * "<name>:" / "Character name:" prefix, and trim a dangling final fragment to the last full sentence.
 * Returns '' when nothing usable remains (caller leaves the character due and retries).
 * `extraLabels` covers callers whose message carries additional sections (the regeneration path).
 */
export function cleanDiscoveredDescription(raw: string, name: string, extraLabels: string[] = []): string {
  let out = stripReasoning(raw || '');
  // Cut from the first echoed scaffold label onward (the model repeating the prompt structure).
  for (const label of [...extraLabels, DISCOVER_PASSAGE_LABEL, DISCOVER_NAME_LABEL]) {
    const at = out.indexOf(label);
    if (at !== -1) out = out.slice(0, at);
  }
  // Strip a leading "Name:" / "Character name: Name" echo before the description proper.
  out = out
    .replace(new RegExp(`^\\s*${escapeRegExp(DISCOVER_NAME_LABEL)}\\s*${escapeRegExp(name.trim())}\\s*`, 'i'), '')
    .replace(new RegExp(`^\\s*${escapeRegExp(name.trim())}\\s*:\\s*`, 'i'), '');
  return trimToLastSentence(out).trim();
}

/**
 * A copy of `location` whose entity-id roster also includes the discovered entities anchored to it, so
 * the existing location-scoped pipeline (buildEntityContext, present-entity filters) treats them as
 * present. Returns the location unchanged when there are none. Undefined location passes through.
 */
export function mergeDiscoveredIntoLocation<T extends GameLocation>(
  location: T | undefined,
  discovered: DiscoveredEntity[],
): T | undefined {
  if (!location) return location;
  const here = discovered.filter((d) => d.locationId === location.id).map((d) => d.entity.id);
  if (here.length === 0) return location;
  return { ...location, entities: [...(location.entities ?? []), ...here] };
}

/**
 * "Bring-them-over": the authored entities that should join the current location as visitors this turn —
 * those living in a **reachable sibling** (a location sharing the current one's non-null parent) that the
 * narration named as participants and that aren't already present. The caller anchors each as a
 * `DiscoveredEntity` at the current location so it flows through the existing present-entity path. Pure.
 * (Matches invented-character discovery's "named in the narration ⇒ in scene" semantics.)
 */
export function selectReachableVisitors(
  participants: string[],
  current: GameLocation | null | undefined,
  locations: GameLocation[],
  authoredEntities: Entity[],
  presentIds: string[],
): Entity[] {
  const parent = current?.parentId ?? null;
  if (!current || parent === null) return [];
  const reachableIds = new Set(
    locations
      .filter((l) => l.id !== current.id && (l.parentId ?? null) === parent)
      .flatMap((l) => l.entities ?? []),
  );
  const present = new Set(presentIds);
  return authoredEntities.filter(
    (e) => reachableIds.has(e.id) && !present.has(e.id) && participants.some((p) => sameCharacterName(p, e.name)),
  );
}
