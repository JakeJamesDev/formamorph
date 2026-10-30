import { describe, it, expect } from 'vitest';
import type { Entity } from '@/types';
import { NO_GAME_COPIES, hasCopies, savedCopy, withCopyOf, withEntityCopies, withEntityCopy, withLiveCopies } from './gameCopies';

const REN = { id: 'ren', name: 'Ren', aiDescription: 'The ferryman.', images: [{ data: 'data:r' }] };

describe('game copies', () => {
  it('lies over the source, which keeps every field the copy leaves alone', () => {
    expect(withEntityCopy(REN, { aiDescription: 'A tired ferryman.' })).toEqual({ ...REN, aiDescription: 'A tired ferryman.' });
  });

  it('hands back the same list when nothing has a copy', () => {
    const list = [REN];
    expect(withEntityCopies(list, NO_GAME_COPIES)).toBe(list);
    expect(withEntityCopies(list, { entities: { other: { name: 'X' } } })).toBe(list);
  });

  it('keeps the old name under Aliases after a rename, once', () => {
    expect(savedCopy({ name: 'Bram' }, REN)).toEqual({ name: 'Bram', aliases: ['Ren'] });
    expect(savedCopy({ name: 'Bram', aliases: ['ren'] }, REN).aliases).toEqual(['ren']);
  });

  it('drops a blank or unchanged name', () => {
    expect(savedCopy({ name: ' ', pronouns: 'he/him' }, REN)).toEqual({ pronouns: 'he/him' });
    expect(savedCopy({ name: 'Ren' }, REN)).toEqual({});
  });

  it('sets and drops one copy, and says when nothing is left', () => {
    const copies = withCopyOf(NO_GAME_COPIES, 'ren', { name: 'Bram' });
    expect(hasCopies(copies)).toBe(true);
    expect(hasCopies(withCopyOf(copies, 'ren', null))).toBe(false);
  });

  it('keeps each persona to its own copy', () => {
    const copies = withCopyOf(NO_GAME_COPIES, 'ren', { pronouns: 'he/him' });
    const cast: Entity[] = [REN as Entity, { id: 'mara', name: 'Mara' }];
    const [ren, mara] = withEntityCopies(cast, copies);
    expect(ren.pronouns).toBe('he/him');
    expect(mara.pronouns).toBeUndefined();
  });

  it('carries the live copies into the turn a re-generate goes back to', () => {
    const live = withCopyOf(NO_GAME_COPIES, 'ren', { pronouns: 'he/him' });
    expect(withLiveCopies({ turn: 7, copies: NO_GAME_COPIES }, live)).toEqual({ turn: 7, copies: live });
  });
});
