import { describe, it, expect } from 'vitest';
import { inGamePersonas } from './personaInGame';
import type { Entity, EntityMetadata } from '@/types';

const wren: EntityMetadata = { id: 'l-wren', name: 'Wren', persona: true, image: 'data:image/webp;base64,AA' };
const ash: EntityMetadata = { id: 'l-ash', name: 'Ash', persona: true };
const plain: EntityMetadata = { id: 'l-plain', name: 'Plain' };
const ids = (list: EntityMetadata[]) => list.map((m) => m.id);

describe('inGamePersonas', () => {
  it('offers the marked library entities', () => {
    expect(ids(inGamePersonas([wren, ash, plain], [], []))).toEqual(['l-wren', 'l-ash']);
  });

  it('drops a persona the world holds a copy of', () => {
    const copy = { id: 'w-copy', name: 'Wren Copy', link: { libraryId: 'l-wren' } } as Entity;
    expect(ids(inGamePersonas([wren, ash], [copy], []))).toEqual(['l-ash']);
  });

  it('drops a persona added as a character at Enter World', () => {
    // Added characters are copies with fresh ids, so the name is what ties them to the library entity.
    expect(ids(inGamePersonas([wren, ash], [], [{ id: 'copy', name: ' wren ' }]))).toEqual(['l-ash']);
  });

  it('keeps a persona that only shares a name with an authored entity', () => {
    expect(ids(inGamePersonas([wren], [{ id: 'w-wren', name: 'Wren' }], []))).toEqual(['l-wren']);
  });
});
