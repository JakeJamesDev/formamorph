import { describe, it, expect } from 'vitest';
import { isSaveEnvelope, migrateSave, APP_VERSION } from './version';
import { parseTurnContent } from './turnDigest';
import type { SaveObject } from '@/types';
import legacySave from './__fixtures__/legacy-save-1.2.1.json';

/**
 * End-to-end migration of a REAL v1.2.1 save exported from the old (upstream JS-era) build. Both import paths
 * converge on migrateSave — the file-import boundary (LoadGameDialog: JSON.parse → isSaveEnvelope → migrateSave)
 * and the same-origin in-place path (dbUtils.migrateLegacySaves copies the `saves` row, then the load path runs
 * migrateSave). This locks that an untouched old save becomes a valid, loadable current-shape save.
 */
describe('legacy v1.2.1 save import', () => {
  // Cast the fixture through unknown — it's the raw exported JSON, not yet the current type.
  const raw = legacySave as unknown as SaveObject;

  it('is recognized as a save envelope', () => {
    expect(isSaveEnvelope(raw)).toBe(true);
  });

  it('migrates the legacy (numeric version 2) save to the current shape', () => {
    const migrated = migrateSave(raw);

    // Version is re-stamped to the current app version (legacy numeric 2 ≙ v1.2).
    expect(typeof raw.version).toBe('number');
    expect(migrated.version).toBe(APP_VERSION);

    // The one canonical flat history is hoisted to the top level (6 messages from the current snapshot).
    expect(migrated.messageHistory).toHaveLength(6);
    // ...and the per-snapshot copies are stripped.
    expect(migrated.currentState.fullMessageHistory).toBeUndefined();
    expect(migrated.stateHistory.every((s) => s.fullMessageHistory === undefined)).toBe(true);

    // v2-only field is stamped on every snapshot.
    expect(migrated.currentState.discoveredEntities).toEqual([]);
    expect(migrated.stateHistory.every((s) => Array.isArray(s.discoveredEntities))).toBe(true);

    // Legacy trait `description` is renamed to `aiDescription` (the trait context builder reads that).
    const trait = migrated.currentState.playerTraits[0] as unknown as Record<string, unknown>;
    expect(trait.aiDescription).toBe('You are The User');
    expect('description' in trait).toBe(false);

    // The one-slot-short history is realigned: current is appended as the final page (2 originals + current).
    expect(migrated.stateHistory).toHaveLength(3);
    expect(migrated.stateHistory[migrated.stateHistory.length - 1]).toEqual(migrated.currentState);
  });

  it('is idempotent — re-migrating an already-migrated save is a no-op', () => {
    const once = migrateSave(raw);
    const twice = migrateSave(once);
    // Second pass sees a string version (non-legacy), so it must not re-append the current page.
    expect(twice.stateHistory).toHaveLength(3);
    expect(twice.version).toBe(APP_VERSION);
    expect(twice).toEqual(once);
  });

  it('narration renders from the migrated history (legacy game_text is read as narration)', () => {
    const migrated = migrateSave(raw);
    const firstAssistant = (migrated.messageHistory ?? []).find((m) => m.role === 'assistant');
    const turn = parseTurnContent(firstAssistant!.content);
    expect(turn?.narration).toContain('The sterile whiteness of The White Room');
    // The legacy `game_text` key is normalized away on read.
    expect((turn as unknown as Record<string, unknown>)?.game_text).toBeUndefined();
  });
});
