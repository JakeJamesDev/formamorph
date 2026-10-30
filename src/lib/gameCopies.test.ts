import { describe, it, expect } from 'vitest';
import { NO_GAME_COPIES, hasCopies, savedCopy, withCopyOf, withEntityCopies, withEntityCopy } from './gameCopies';

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
});
