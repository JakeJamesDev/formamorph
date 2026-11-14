import { describe, expect, it } from 'vitest';
import { supporterCopyAllows, supporterCopyBlock, type SupporterCopyAction } from './supporterCopy';

const marker = { listingId: 'listing-1', accountId: 'account-1', revision: 3 };
const world = { supporterCopy: marker };
const entry = { supporterCopy: { ...marker, sourceWorldId: 'world-1' } };

const WORLD_BLOCKED: SupporterCopyAction[] = [
  'exportWorld', 'exportEntity', 'exportDictionary', 'exportSave', 'exportAiContext', 'duplicate', 'publish', 'downloadMedia', 'backup', 'crashExport',
];
const ENTRY_BLOCKED: SupporterCopyAction[] = ['exportEntity', 'exportDictionary', 'duplicate', 'publish', 'downloadMedia', 'backup'];
const EVERY: SupporterCopyAction[] = [...WORLD_BLOCKED, 'saveToLibrary', { addToWorld: 'world-1' }, { addToWorld: 'world-2' }];

describe('supporterCopyBlock', () => {
  it.each(WORLD_BLOCKED)('blocks %s on a Supporter Copy world, with a reason', (action) => {
    expect(supporterCopyBlock(world, action)).toMatch(/Supporter world/);
    expect(supporterCopyAllows(world, action)).toBe(false);
  });

  it('allows Save to Library on a Supporter Copy world', () => {
    expect(supporterCopyAllows(world, 'saveToLibrary')).toBe(true);
  });

  it.each(EVERY)('allows %j on a plain world, a null record and an absent marker', (action) => {
    expect(supporterCopyBlock({}, action)).toBeNull();
    expect(supporterCopyBlock({ supporterCopy: null }, action)).toBeNull();
    expect(supporterCopyBlock(null, action)).toBeNull();
    expect(supporterCopyBlock(undefined, action)).toBeNull();
  });

  it.each(ENTRY_BLOCKED)('blocks %s on a library entry saved from a Supporter Copy', (action) => {
    expect(supporterCopyBlock(entry, action)).toMatch(/saved from a Supporter world/);
  });

  it('lets a marked library entry go only into its source world', () => {
    expect(supporterCopyAllows(entry, { addToWorld: 'world-1' })).toBe(true);
    expect(supporterCopyBlock(entry, { addToWorld: 'world-2' })).toBe('You can only add this to the Supporter world it came from');
  });

  it('allows Save to Library on a marked library entry', () => {
    expect(supporterCopyAllows(entry, 'saveToLibrary')).toBe(true);
  });
});
