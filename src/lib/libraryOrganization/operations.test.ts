import { describe, it, expect } from 'vitest';
import {
  addToGroup,
  createGroupFromDrop,
  createGroupFromItem,
  disbandGroup,
  groupOf,
  moveTile,
  pruneOrganization,
  removeFromGroup,
  renameGroup,
  setGroupPromptPreset,
  setTileSize,
  tileSize,
  topLevelIds,
} from './operations';
import { emptyTabOrganization, NEW_GROUP_NAME, type LibraryTabOrganization } from './types';

/** A tab holding `ids` at the top level and nothing else. */
const withItems = (...ids: string[]): LibraryTabOrganization => ({ ...emptyTabOrganization(), order: ids });

/** `a` and `b` grouped as `g1`, with `c` still loose beside the folder. */
const withGroup = (): LibraryTabOrganization =>
  createGroupFromDrop(withItems('a', 'b', 'c'), { groupId: 'g1', dragId: 'b', targetId: 'a' });

/** Two folders in one tab: `g1` holds a and b, `g2` holds c and d. */
const withTwoGroups = (): LibraryTabOrganization =>
  createGroupFromDrop(
    createGroupFromDrop(withItems('a', 'b', 'c', 'd'), { groupId: 'g1', dragId: 'b', targetId: 'a' }),
    { groupId: 'g2', dragId: 'd', targetId: 'c' },
  );

describe('createGroupFromDrop', () => {
  it('folds both tiles into a new group that takes the target tile place', () => {
    const org = withGroup();

    expect(org.order).toEqual(['g1', 'c']);
    expect(org.groups.g1.members).toEqual(['a', 'b']);
    expect(org.groups.g1.name).toBe(NEW_GROUP_NAME);
    expect(org.groups.g1.settings).toEqual({});
  });

  it('gives the new folder the size of the tile it was dropped on', () => {
    const org = setTileSize(withItems('a', 'b'), 'a', 'large');

    expect(tileSize(createGroupFromDrop(org, { groupId: 'g1', dragId: 'b', targetId: 'a' }), 'g1'))
      .toBe('large');
  });

  it('refuses to nest a group inside a group', () => {
    const org = withGroup();

    expect(createGroupFromDrop(org, { groupId: 'g2', dragId: 'g1', targetId: 'c' })).toBe(org);
    expect(createGroupFromDrop(org, { groupId: 'g2', dragId: 'c', targetId: 'g1' })).toBe(org);
  });

  it('refuses to group a tile with itself', () => {
    const org = withItems('a', 'b');

    expect(createGroupFromDrop(org, { groupId: 'g1', dragId: 'a', targetId: 'a' })).toBe(org);
  });

  it('takes the dragged item out of the folder it was already in', () => {
    const org = createGroupFromDrop(withGroup(), { groupId: 'g2', dragId: 'b', targetId: 'c' });

    expect(org.groups.g1.members).toEqual(['a']);
    expect(org.groups.g2.members).toEqual(['c', 'b']);
  });

  it('lists the folder even when the tile dropped on was never in the saved order', () => {
    // The common case on a library that has never been rearranged: the order is empty and every tile
    // is drawn by the sort-to-end rule. A folder left out of the order would render nowhere at all.
    const org = createGroupFromDrop(emptyTabOrganization(), { groupId: 'g1', dragId: 'b', targetId: 'a' });

    expect(org.order).toEqual(['g1']);
    expect(topLevelIds(org, ['a', 'b', 'c'])).toEqual(['g1', 'c']);
  });
});

describe('createGroupFromItem', () => {
  it('puts a lone tile in a folder standing where the tile stood', () => {
    const org = createGroupFromItem(withItems('a', 'b', 'c'), { groupId: 'g1', itemId: 'b' });

    expect(org.order).toEqual(['a', 'g1', 'c']);
    expect(org.groups.g1.members).toEqual(['b']);
    expect(org.groups.g1.name).toBe(NEW_GROUP_NAME);
  });

  it('lists the folder even when the tile was never in the saved order', () => {
    const org = createGroupFromItem(emptyTabOrganization(), { groupId: 'g1', itemId: 'b' });

    expect(topLevelIds(org, ['a', 'b'])).toEqual(['g1', 'a']);
  });

  it('takes an already-grouped tile out of its old folder', () => {
    const org = createGroupFromItem(withGroup(), { groupId: 'g2', itemId: 'b' });

    expect(org.groups.g1.members).toEqual(['a']);
    expect(org.groups.g2.members).toEqual(['b']);
    expect(org.order).toEqual(['g1', 'c', 'g2']);
  });

  it('refuses to wrap a folder in another folder', () => {
    const org = withGroup();

    expect(createGroupFromItem(org, { groupId: 'g2', itemId: 'g1' })).toBe(org);
  });
});

describe('addToGroup', () => {
  it('moves a loose tile into the folder and off the top level', () => {
    const org = addToGroup(withGroup(), 'c', 'g1');

    expect(org.groups.g1.members).toEqual(['a', 'b', 'c']);
    expect(org.order).toEqual(['g1']);
  });

  it('moves a tile between folders without leaving a copy behind', () => {
    const org = addToGroup(withTwoGroups(), 'b', 'g2');

    expect(org.groups.g1.members).toEqual(['a']);
    expect(org.groups.g2.members).toEqual(['c', 'd', 'b']);
  });

  it('refuses to put a group inside another group', () => {
    const org = withTwoGroups();

    expect(addToGroup(org, 'g1', 'g2')).toBe(org);
  });

  it('ignores a group that does not exist', () => {
    const org = withGroup();

    expect(addToGroup(org, 'c', 'missing')).toBe(org);
  });

  it('ignores an item already in that folder', () => {
    const org = withGroup();

    expect(addToGroup(org, 'a', 'g1')).toBe(org);
  });
});

describe('removeFromGroup', () => {
  it('returns the item to the main grid', () => {
    const org = removeFromGroup(addToGroup(withGroup(), 'c', 'g1'), 'b');

    expect(org.groups.g1.members).toEqual(['a', 'c']);
    expect(org.order).toEqual(['g1', 'b']);
  });

  it('disbands a folder emptied by its last removal', () => {
    const org = removeFromGroup(removeFromGroup(withGroup(), 'a'), 'b');

    expect(org.groups).toEqual({});
    expect(org.order).toEqual(['c', 'a', 'b']);
  });

  it('ignores an item that is in no folder', () => {
    const org = withGroup();

    expect(removeFromGroup(org, 'c')).toBe(org);
  });
});

describe('disbandGroup', () => {
  it('puts the members back where the folder stood, so deleting a group loses nothing', () => {
    const org = disbandGroup(withGroup(), 'g1');

    expect(org.order).toEqual(['a', 'b', 'c']);
    expect(org.groups).toEqual({});
  });

  it('forgets the folder tile own size', () => {
    const org = disbandGroup(setTileSize(withGroup(), 'g1', 'large'), 'g1');

    expect(org.sizes.g1).toBeUndefined();
  });

  it('ignores a group that does not exist', () => {
    const org = withGroup();

    expect(disbandGroup(org, 'missing')).toBe(org);
  });
});

describe('renameGroup', () => {
  it('takes the new name, trimmed', () => {
    expect(renameGroup(withGroup(), 'g1', '  Favorites  ').groups.g1.name).toBe('Favorites');
  });

  it('keeps the old name when the field is emptied, so a folder is never nameless', () => {
    expect(renameGroup(withGroup(), 'g1', '   ').groups.g1.name).toBe(NEW_GROUP_NAME);
  });
});

describe('setTileSize', () => {
  it('sizes items and folders alike', () => {
    const org = setTileSize(setTileSize(withGroup(), 'c', 'small'), 'g1', 'large');

    expect(tileSize(org, 'c')).toBe('small');
    expect(tileSize(org, 'g1')).toBe('large');
  });

  it('reads an unsized tile as medium and stores no entry for medium', () => {
    const org = setTileSize(setTileSize(withItems('a'), 'a', 'large'), 'a', 'medium');

    expect(tileSize(org, 'a')).toBe('medium');
    expect(org.sizes).toEqual({});
  });
});

describe('moveTile', () => {
  it('reorders the top level, before or after the tile dropped on', () => {
    expect(moveTile(withItems('a', 'b', 'c'), { activeId: 'c', overId: 'a', position: 'before' }).order)
      .toEqual(['c', 'a', 'b']);
    expect(moveTile(withItems('a', 'b', 'c'), { activeId: 'a', overId: 'c', position: 'after' }).order)
      .toEqual(['b', 'c', 'a']);
  });

  it('reorders inside a folder without touching the top level', () => {
    const org = moveTile(addToGroup(withGroup(), 'c', 'g1'), {
      activeId: 'c', overId: 'a', position: 'before', container: 'g1',
    });

    expect(org.groups.g1.members).toEqual(['c', 'a', 'b']);
    expect(org.order).toEqual(['g1']);
  });

  it('ignores a move onto itself, or onto a tile in another list', () => {
    const org = withGroup();

    expect(moveTile(org, { activeId: 'c', overId: 'c', position: 'before' })).toBe(org);
    expect(moveTile(org, { activeId: 'c', overId: 'a', position: 'before' })).toBe(org);
  });
});

describe('group settings', () => {
  it('carries a prompt preset on the folder', () => {
    expect(setGroupPromptPreset(withGroup(), 'g1', 'noir').groups.g1.settings.promptPreset).toBe('noir');
  });

  it('clears the preset back to no group setting at all', () => {
    const set = setGroupPromptPreset(withGroup(), 'g1', 'noir');

    expect(setGroupPromptPreset(set, 'g1', null).groups.g1.settings).toEqual({});
  });

  it('keeps settings this version does not know about, so a later key survives an edit here', () => {
    const org = withGroup();
    const seeded: LibraryTabOrganization = {
      ...org,
      groups: { g1: { ...org.groups.g1, settings: { promptPreset: 'noir', later: 'kept' } } },
    };

    expect(setGroupPromptPreset(seeded, 'g1', null).groups.g1.settings).toEqual({ later: 'kept' });
  });
});

describe('groupOf', () => {
  it('names the folder an item sits in, and nothing for a loose item', () => {
    const org = withGroup();

    expect(groupOf(org, 'b')?.id).toBe('g1');
    expect(groupOf(org, 'c')).toBeUndefined();
  });
});

describe('topLevelIds', () => {
  it('shows folders and loose items in the saved order, and hides grouped items', () => {
    expect(topLevelIds(withGroup(), ['a', 'b', 'c'])).toEqual(['g1', 'c']);
  });

  it('sorts an id the order has never seen to the end, as the flat grid always did', () => {
    expect(topLevelIds(withItems('b', 'a'), ['a', 'b', 'fresh'])).toEqual(['b', 'a', 'fresh']);
  });

  it('drops an item that is no longer in the library, and the folder left empty by it', () => {
    expect(topLevelIds(withGroup(), ['c'])).toEqual(['c']);
  });
});

describe('pruneOrganization', () => {
  it('forgets items the library no longer holds', () => {
    const org = pruneOrganization(addToGroup(withGroup(), 'c', 'g1'), ['a', 'c']);

    expect(org.groups.g1.members).toEqual(['a', 'c']);
    expect(org.order).toEqual(['g1']);
  });

  it('disbands a folder whose members were all deleted', () => {
    const org = pruneOrganization(withGroup(), ['c']);

    expect(org.groups).toEqual({});
    expect(org.order).toEqual(['c']);
  });

  it('drops the sizes of tiles that are gone', () => {
    const org = pruneOrganization(setTileSize(withItems('a', 'b'), 'b', 'small'), ['a']);

    expect(org.sizes).toEqual({});
  });

  it('changes nothing when every id is still there', () => {
    const org = withGroup();

    expect(pruneOrganization(org, ['a', 'b', 'c'])).toBe(org);
  });
});
