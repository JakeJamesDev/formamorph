import type { SceneEntity } from '@/types';

/** Normalize a snapshot's `visibleEntities`: legacy saves stored a bare `string[]` of names; those become
 *  `{ name, revealed: true }` (a name that was in the old list had, by construction, been shown already). */
export function normalizeVisibleEntities(raw: unknown): SceneEntity[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e) =>
    typeof e === 'string' ? { name: e, revealed: true } : (e as SceneEntity),
  );
}
