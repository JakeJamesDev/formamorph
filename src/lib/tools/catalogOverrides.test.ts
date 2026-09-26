/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import type { Tool } from '@/types';
import { TOOL_CATALOG } from './toolCatalog';
import { toolsOfferedTo } from './toolOffer';
import { catalogOverridesCodec, saveCatalogOverride, withCatalogOverrides } from './catalogOverrides';

const GET_ENTITY = TOOL_CATALOG.find((t) => t.id === 'get_entity')!;
const SHIPPED = structuredClone(GET_ENTITY);

describe('withCatalogOverrides', () => {
  it('replaces Offered To and the call limit and keeps the definition', () => {
    const [tool] = withCatalogOverrides(TOOL_CATALOG, { get_entity: { offeredTo: ['choices', 'narration'], callLimit: 2 } });
    expect(tool).toEqual({ ...SHIPPED, offeredTo: ['choices', 'narration'], callLimit: 2 });
    expect(GET_ENTITY).toEqual(SHIPPED);
  });

  it('drops a shipped call limit the override leaves out', () => {
    const catalog: Tool[] = [{ ...SHIPPED, callLimit: 3 }];
    expect(withCatalogOverrides(catalog, { get_entity: { offeredTo: [] } })[0]).not.toHaveProperty('callLimit');
  });

  it('leaves a Tool with no override as shipped', () => {
    expect(withCatalogOverrides(TOOL_CATALOG, {})).toEqual([SHIPPED]);
  });
});

describe('saveCatalogOverride', () => {
  it('stores only Offered To and the call limit of an edited catalog Tool', () => {
    const edited: Tool = { ...SHIPPED, description: 'changed', emptyResult: 'none', offeredTo: ['summary'], callLimit: 4 };
    expect(saveCatalogOverride({}, edited)).toEqual({ get_entity: { offeredTo: ['summary'], callLimit: 4 } });
  });

  it('replaces the earlier override, call limit included', () => {
    const before = { get_entity: { offeredTo: ['summary' as const], callLimit: 4 } };
    expect(saveCatalogOverride(before, { ...SHIPPED, offeredTo: ['diary'] })).toEqual({ get_entity: { offeredTo: ['diary'] } });
  });

  it('clears the override when the Availability matches the shipped Tool', () => {
    const before = { get_entity: { offeredTo: ['summary' as const], callLimit: 4 } };
    expect(saveCatalogOverride(before, SHIPPED)).toEqual({});
    const twoKinds = { ...SHIPPED, offeredTo: ['choices' as const, 'narration' as const] };
    const stored = saveCatalogOverride({}, twoKinds);
    expect(stored).toEqual({ get_entity: { offeredTo: ['choices', 'narration'] } });
    expect(saveCatalogOverride(stored, { ...SHIPPED, callLimit: 2 })).toEqual({ get_entity: { offeredTo: ['narration'], callLimit: 2 } });
  });

  it('ignores a user Tool', () => {
    const before = {};
    expect(saveCatalogOverride(before, { ...SHIPPED, id: 'u-1', name: 'mine' })).toBe(before);
  });
});

describe('catalogOverridesCodec', () => {
  it('round-trips an override', () => {
    const overrides = { get_entity: { offeredTo: ['narration' as const, 'choices' as const], callLimit: 2 } };
    expect(catalogOverridesCodec.parse(catalogOverridesCodec.serialize(overrides))).toEqual(overrides);
  });

  it('drops unknown ids, unreadable entries and bad call limits, and unknown prompt kinds', () => {
    const raw = JSON.stringify({
      get_entity: { offeredTo: ['narration', 'fromTheFuture'], callLimit: 0 },
      gone_tool: { offeredTo: ['narration'] },
    });
    expect(catalogOverridesCodec.parse(raw)).toEqual({});
    expect(catalogOverridesCodec.parse(JSON.stringify({ get_entity: { offeredTo: ['narration', 'fromTheFuture'] } })))
      .toEqual({ get_entity: { offeredTo: ['narration'] } });
    expect(catalogOverridesCodec.parse(JSON.stringify({ get_entity: { offeredTo: 'narration' } }))).toEqual({});
    expect(catalogOverridesCodec.parse('not json')).toEqual({});
  });
});

describe('the offer with an override', () => {
  it('offers the catalog Tool to the overridden prompts and not the shipped one', () => {
    const tools = withCatalogOverrides(TOOL_CATALOG, { get_entity: { offeredTo: ['choices'] } });
    const on = { get_entity: true };
    expect(toolsOfferedTo('choices', tools, on, true).map((t) => t.id)).toEqual(['get_entity']);
    expect(toolsOfferedTo('narration', tools, on, true)).toEqual([]);
  });
});
