import { describe, expect, it } from 'vitest';
import { libraryCopy } from './libraryCopy';

describe('libraryCopy', () => {
  const source = { id: 'book-1', name: 'Sedge Lore', entries: [{ id: 'e1', name: 'Ferry' }] };

  it('gives the record and its data the same new id and a Copy name', () => {
    const copy = libraryCopy(source);

    expect(copy.id).not.toBe(source.id);
    expect(copy.data.id).toBe(copy.id);
    expect(copy.name).toBe('Sedge Lore (Copy)');
    expect(copy.data.name).toBe(copy.name);
  });

  it('leaves the original untouched', () => {
    const copy = libraryCopy(source);
    copy.data.entries[0].name = 'Changed';

    expect(source).toEqual({ id: 'book-1', name: 'Sedge Lore', entries: [{ id: 'e1', name: 'Ferry' }] });
  });

  it('keeps the library details as its own copy', () => {
    const details = { author: 'Wren', tags: ['river'] };
    const copy = libraryCopy(source, details);
    copy.libraryDetails?.tags?.push('changed');

    expect(copy.libraryDetails).toEqual({ author: 'Wren', tags: ['river', 'changed'] });
    expect(details.tags).toEqual(['river']);
  });

  it('carries no community link', () => {
    const copy = libraryCopy(source);

    expect(Object.keys(copy).sort()).toEqual(['data', 'id', 'name']);
  });
});
