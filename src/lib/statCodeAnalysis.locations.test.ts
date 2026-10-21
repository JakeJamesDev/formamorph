import { describe, expect, it } from 'vitest';
import { codeCompletions, type SurfaceAnalysisOptions } from './statCodeAnalysis';
import { ENTITY_FIELDS, LOCATION_ENTRY_FIELDS, LOCATION_MEMBERS, scriptSurface, WORLD_SCRIPT_SURFACE } from './statCodeSurface';

const options: SurfaceAnalysisOptions = {
  surface: scriptSurface(WORLD_SCRIPT_SURFACE, 'after'), locations: ['Inn', 'North Gate'],
  entities: [{ id: 'mira', name: 'Mira', traits: [], persona: false }],
};

const labelsAt = (doc: string) => {
  const pos = doc.indexOf('|');
  return (codeCompletions(doc.replace('|', ''), pos, options)?.options ?? []).map((option) => option.label);
};

describe('completion over the locations surface', () => {
  it('offers the dotted location names after locations., and every name in brackets', () => {
    expect(labelsAt('locations.|')).toEqual(['Inn']);
    expect(labelsAt('locations["|')).toEqual(expect.arrayContaining(['Inn', 'North Gate']));
  });

  it('offers an entry’s fields, location’s fields with move, and the new entity fields', () => {
    expect(labelsAt('locations.Inn.|')).toEqual(LOCATION_ENTRY_FIELDS.map((field) => field.name));
    expect(labelsAt('location.|')).toEqual(LOCATION_MEMBERS.map((field) => field.name));
    expect(labelsAt('entities.Mira.|')).toEqual(ENTITY_FIELDS.map((field) => field.name));
    expect(ENTITY_FIELDS.map((field) => field.name)).toEqual(expect.arrayContaining(['location', 'following', 'description', 'summary', 'aliases']));
  });
});
