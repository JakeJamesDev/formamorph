import { describe, expect, it } from 'vitest';
import { effectiveLinkTrait, linkTraitState, resetLinkOverride, setLinkEdits } from './blueprints';
import type { Script, Trait, TraitLink } from '@/types';

const original: Script[] = [{ id: 'a', timing: 'after', code: 'stats.HP.value = 1;' }];
const howl: Trait = { id: 'howl', name: 'Howl', statChanges: [], groupId: 'bp', scripts: original };
const link: TraitLink = { id: 'l', originalId: 'howl', kind: 'trait', originalName: 'Howl', groupId: null };

describe('a trait link’s scripts (Q40)', () => {
  it('overrides the whole list from an editor’s edit, and reads it back', () => {
    const edited: Script[] = [...original, { id: 'b', timing: 'before', code: 'stats.HP.value = 2;' }];
    const next = setLinkEdits(link, howl, { ...howl, scripts: edited });
    expect(next.overrides?.howl).toEqual({ scripts: { value: edited, blueprint: original } });
    expect(effectiveLinkTrait(howl, next).scripts).toEqual(edited);
    expect(linkTraitState(howl, next).overridden).toEqual(['scripts']);
  });

  it('overrides to no scripts when the editor removes them all', () => {
    const next = setLinkEdits(link, howl, { ...howl, scripts: undefined });
    expect(effectiveLinkTrait(howl, next).scripts).toEqual([]);
  });

  it('reads the Blueprint’s scripts again on Reset, and goes stale when the Blueprint changes them', () => {
    const next = setLinkEdits(link, howl, { ...howl, scripts: [] });
    expect(effectiveLinkTrait(howl, resetLinkOverride(next, 'howl', 'scripts')).scripts).toEqual(original);
    const moved = { ...howl, scripts: [{ ...original[0], code: 'stats.HP.value = 3;' }] };
    expect(linkTraitState(moved, next).stale).toEqual(['scripts']);
  });

  it('leaves a link that never touched the scripts reading the Blueprint’s', () => {
    expect(effectiveLinkTrait(howl, link).scripts).toBe(original);
  });
});
