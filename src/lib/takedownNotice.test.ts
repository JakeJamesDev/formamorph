import { describe, it, expect } from 'vitest';
import { takedownTargetFor, takedownTemplate } from './takedownNotice';

const listing = (over: Record<string, unknown> = {}) => ({
  kind: 'world',
  name: 'Sedge Landing',
  author: { id: 'author-1', username: 'alice' },
  ...over,
});

describe('who gets offered a takedown notice', () => {
  it("offers one for somebody else's work", () => {
    expect(takedownTargetFor(listing(), 'admin-1')).toEqual({
      author: { id: 'author-1', username: 'alice' },
      kind: 'world',
      name: 'Sedge Landing',
    });
  });

  it('offers none for your own', () => {
    // Deleting your own upload needs no explanation, and the composer would have you as the recipient.
    expect(takedownTargetFor(listing(), 'author-1')).toBeNull();
  });

  it('offers none when the listing records no author', () => {
    expect(takedownTargetFor(listing({ author: null }), 'admin-1')).toBeNull();
    expect(takedownTargetFor(listing({ author: undefined }), 'admin-1')).toBeNull();
  });

  it('offers none when the author is missing an ID or a name', () => {
    // A message needs both: one to address it, the other to say who it is about.
    expect(takedownTargetFor(listing({ author: { username: 'alice' } }), 'admin-1')).toBeNull();
    expect(takedownTargetFor(listing({ author: { id: 'author-1' } }), 'admin-1')).toBeNull();
    expect(takedownTargetFor(listing({ author: { id: '', username: 'alice' } }), 'admin-1')).toBeNull();
  });

  it('does not special-case an unknown deleter', () => {
    // Deleting needs a signed-in owner or admin, so this cannot happen in the app; the check is only
    // ever "is this me", and an absent ID is simply not a match.
    expect(takedownTargetFor(listing(), undefined)).toEqual(expect.objectContaining({ kind: 'world' }));
  });

  it('reads the kind from the listing', () => {
    expect(takedownTargetFor(listing({ kind: 'entity' }), 'admin-1')?.kind).toBe('entity');
    expect(takedownTargetFor(listing({ kind: 'dictionary' }), 'admin-1')?.kind).toBe('dictionary');
  });

  it('treats a listing with no kind as a world, as the rest of the catalog does', () => {
    expect(takedownTargetFor(listing({ kind: undefined }), 'admin-1')?.kind).toBe('world');
  });

  it('falls back to the kind label when the listing has no name', () => {
    // The notice has to read as something; the item is gone, so there is nothing to look up.
    expect(takedownTargetFor(listing({ name: undefined }), 'admin-1')?.name).toBe('World');
    expect(takedownTargetFor(listing({ kind: 'entity', name: '' }), 'admin-1')?.name).toBe('Entity');
  });
});

describe('the notice wording', () => {
  const target = { author: { id: 'author-1', username: 'alice' }, kind: 'world' as const, name: 'Sedge Landing' };

  it('names the item and its kind, since it is already gone', () => {
    const { subject, body } = takedownTemplate(target);

    expect(subject).toBe('Your world "Sedge Landing" was removed');
    expect(body).toContain('**"Sedge Landing"**');
    expect(body).toContain('removed from Community Creations');
  });

  it('leaves the reason for the admin to write', () => {
    // A takedown with no reason attached is the problem this whole prompt exists to solve.
    expect(takedownTemplate(target).body).toMatch(/\*\*Reason:\*\* $/);
  });

  it('says character or dictionary when that is what was removed', () => {
    expect(takedownTemplate({ ...target, kind: 'entity' }).subject).toContain('Your entity');
    expect(takedownTemplate({ ...target, kind: 'dictionary' }).subject).toContain('Your dictionary');
  });
});
