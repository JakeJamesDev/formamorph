import { describe, it, expect } from 'vitest';
import { checkMissingSources, isSourceRule } from './missingSources';
import { linkedSourceCopies, type SourceCheckWorld } from '@/lib/sourceChecks';
import { groupFindings } from './rules';
import type { Dictionary, Entity } from '@/types';

const entity = (id: string, name: string, link?: Entity['link']): Entity =>
  ({ id, name, ...(link ? { link } : {}) }) as Entity;

const book = (id: string, name: string, link?: Dictionary['link']): Dictionary =>
  ({ id, name, entries: [], ...(link ? { link } : {}) }) as Dictionary;

const world: SourceCheckWorld = {
  entities: [entity('e1', 'Warden', { sourceId: 'src-a', sourceName: 'Marsh Warden' })],
  dictionaries: [book('d1', 'Lore', { sourceId: 'src-b', sourceName: 'Fen Lore' })],
};

describe('checkMissingSources', () => {
  it('reports a definite not-found answer as removed, naming the world’s need for it', () => {
    const findings = checkMissingSources(linkedSourceCopies(world, ['src-a']), { 'src-a': 'not_found' });
    expect(findings).toEqual([{
      ruleId: 'source-not-found',
      severity: 'error',
      section: 'entities',
      message: '“Marsh Warden” was removed by its author, and this world requires it',
      items: [{ id: 'e1', name: 'Warden', section: 'entities' }],
    }]);
  });

  it('reports an optional removed source without claiming the world requires it', () => {
    const findings = checkMissingSources(linkedSourceCopies(world), { 'src-a': 'not_found' });
    expect(findings[0].message).toBe('“Marsh Warden” was removed by its author');
  });

  it('reports any other failure as unchecked, never as removed', () => {
    const findings = checkMissingSources(linkedSourceCopies(world, ['src-a']), { 'src-a': 'unavailable' });
    expect(findings).toMatchObject([{
      ruleId: 'source-unavailable',
      severity: 'warning',
      message: 'Formamorph could not check “Marsh Warden”',
    }]);
  });

  it('sends a book copy’s item to the dictionary tab', () => {
    const findings = checkMissingSources(linkedSourceCopies(world), { 'src-b': 'not_found' });
    expect(findings[0].items).toEqual([{ id: 'd1', name: 'Lore', section: 'dictionary' }]);
  });

  it('raises one finding per copy, so two copies of one gone source each get a repair', () => {
    const twoCopies: SourceCheckWorld = {
      entities: [
        entity('e1', 'Warden', { sourceId: 'src-a', sourceName: 'Marsh Warden' }),
        entity('e2', 'Warden Two', { sourceId: 'src-a', sourceName: 'Marsh Warden' }),
      ],
    };
    const findings = checkMissingSources(linkedSourceCopies(twoCopies), { 'src-a': 'not_found' });
    expect(findings.map((f) => f.items[0].id)).toEqual(['e1', 'e2']);
  });

  it('raises nothing when every source answered', () => {
    expect(checkMissingSources(linkedSourceCopies(world), { 'src-a': 'ok', 'src-b': 'ok' })).toEqual([]);
  });

  it('groups into the rows the Issues list draws, worst first', () => {
    const findings = checkMissingSources(
      linkedSourceCopies(world, ['src-a']), { 'src-a': 'unavailable', 'src-b': 'not_found' },
    );
    expect(groupFindings(findings).map((g) => [g.ruleId, g.severity]))
      .toEqual([['source-not-found', 'error'], ['source-unavailable', 'warning']]);
  });
});

describe('isSourceRule', () => {
  it('knows the two rows that draw their own repairs', () => {
    expect(isSourceRule('source-not-found')).toBe(true);
    expect(isSourceRule('source-unavailable')).toBe(true);
    expect(isSourceRule('world-too-large')).toBe(false);
  });
});
