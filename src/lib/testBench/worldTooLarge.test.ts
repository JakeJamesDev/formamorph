import { describe, it, expect } from 'vitest';
import type { WorldOverview } from '@/types';
import { PUBLISH_LIMITS } from '@/lib/publishLimits';
import { checkWorldSize, WORLD_TOO_LARGE } from './worldTooLarge';
import { groupFindings, RULES, type RuleWorld } from './rules';

const world = (name = 'Sedge Landing'): RuleWorld => ({
  worldOverview: { name, description: '' } as WorldOverview,
  stats: [], locations: [], entities: [], traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

describe('the out-of-band publish-size finding', () => {
  it('says nothing while no measure has landed yet', () => {
    expect(checkWorldSize(world(), null)).toEqual([]);
  });

  it('says nothing under the limit', () => {
    expect(checkWorldSize(world(), PUBLISH_LIMITS.world - 1)).toEqual([]);
  });

  it('raises a warning at the limit, naming the size and the limit', () => {
    const [found] = checkWorldSize(world(), PUBLISH_LIMITS.world);

    expect(found.ruleId).toBe(WORLD_TOO_LARGE.id);
    expect(found.severity).toBe('warning');
    expect(found.section).toBe('overview');
    expect(found.message).toBe('The world is 100.0 MB, over the 100.0 MB publish limit.');
  });

  it('opens the Overview from its item, and carries no fix', () => {
    const [found] = checkWorldSize(world(), PUBLISH_LIMITS.world + 1);

    expect(found.items).toEqual([{ id: 'overview', name: 'Sedge Landing' }]);
    expect(WORLD_TOO_LARGE.fix).toBeUndefined();
  });

  it('does not add to the rule catalog Triggers and the rule count read from', () => {
    expect(RULES.some((rule) => rule.id === WORLD_TOO_LARGE.id)).toBe(false);
  });

  it('collapses into one counted row like any other rule', () => {
    const [group] = groupFindings(checkWorldSize(world(), PUBLISH_LIMITS.world));

    expect(group.headline).toBe('The world is 100.0 MB, over the 100.0 MB publish limit.');
    expect(group.fixable).toBe(false);
  });
});
