import { describe, expect, it } from 'vitest';
import { buildLongSave } from './longSave';
import { isSaveEnvelope, migrateSave } from '@/lib/version';
import { parseTurnContent } from '@/lib/turnDigest';
import whiteRoomSave from './whiteRoomSave.json';
import type { SaveObject } from '@/types';

const base = whiteRoomSave as unknown as SaveObject;
const narrations = ['First real narration.', 'Second real narration.'];
const images = ['data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,BBBB'];

describe('buildLongSave', () => {
  const save = buildLongSave(base, { turns: 50, narrations, images, imageEvery: 20 });

  it('holds one action and one narration per turn, the opening first', () => {
    const history = save.messageHistory!;
    expect(history).toHaveLength(100);
    expect(history[0]).toEqual({ role: 'user', content: 'START GAME' });
    expect(parseTurnContent(history[1].content)?.narration).toBe('First real narration.');
    expect(parseTurnContent(history[3].content)?.narration).toBe('Second real narration.');
    expect(history[2].role).toBe('user');
  });

  it('gives every narration its own turn id, and one snapshot per turn', () => {
    const ids = save.messageHistory!.filter((m) => m.role === 'assistant').map((m) => parseTurnContent(m.content)?.turnId);
    expect(new Set(ids).size).toBe(50);
    expect(save.stateHistory).toHaveLength(50);
  });

  it('puts a scene image on every twentieth turn', () => {
    const ids = save.messageHistory!.filter((m) => m.role === 'assistant').map((m) => parseTurnContent(m.content)!.turnId!);
    expect(Object.keys(save.sceneImages ?? {})).toEqual([ids[0], ids[20], ids[40]]);
    expect(save.sceneImages![ids[20]]).toEqual([images[1]]);
  });

  it('is a save the loader accepts as it stands', () => {
    expect(isSaveEnvelope(save)).toBe(true);
    const migrated = migrateSave(save);
    expect(migrated.messageHistory).toHaveLength(100);
    expect(migrated.stateHistory).toHaveLength(50);
  });
});
