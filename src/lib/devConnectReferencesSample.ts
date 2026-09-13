/**
 * DEV-only stand-in for the rows the Connect World References step raises. Dynamically imported by
 * `#dev?view=mainMenu&modal=connectReferences`, so the step is reachable without a library item, a world
 * that lacks what it expects, and an add to put the two together.
 *
 * It carries every shape a row takes: a single clear match, an ambiguous pair that preselects nothing, a
 * reference this world answers with nothing, and a location.
 */
import { suggestedChoices, type ReferenceChoices, type ReferenceRow } from '@/lib/worldReferences';

export function devReferenceRows(): ReferenceRow[] {
  const worldPlaceholders = [
    { id: 'w-cap-north', name: 'Capital', values: ['Sedge Landing'] },
    { id: 'w-cap-south', name: 'Capital', values: ['Harrow'] },
    { id: 'w-river', name: 'River', values: ['The Ash', 'The Mire'] },
    { id: 'w-ruler', name: 'Ruler', values: ['Warden Ilse'] },
  ];
  return [
    {
      kind: 'placeholder', key: 'src-cap', name: 'Capital', expects: ['Aldreth'],
      candidates: worldPlaceholders, suggested: null, ambiguous: true,
    },
    {
      kind: 'placeholder', key: 'src-river', name: 'River', expects: ['The Long Water'],
      candidates: [worldPlaceholders[2], ...worldPlaceholders.filter((p) => p.id !== 'w-river')],
      suggested: 'w-river', ambiguous: false,
    },
    {
      kind: 'placeholder', key: 'src-weather', name: 'Weather', expects: ['Rain', 'Fog', 'Clear'],
      candidates: worldPlaceholders, suggested: null, ambiguous: false,
    },
    {
      kind: 'location', key: 'src-inn', name: 'The Drowned Bell', expects: [],
      candidates: [
        { id: 'w-harbor', name: 'Harbor Steps', values: [] },
        { id: 'w-market', name: 'The Long Market', values: [] },
      ],
      suggested: null, ambiguous: false,
    },
  ];
}

/** The answers the step opens on, so the sample lands the way a real one does. */
export function devReferenceChoices(rows: ReferenceRow[]): ReferenceChoices {
  return suggestedChoices(rows);
}
