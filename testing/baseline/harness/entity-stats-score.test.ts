import { describe, expect, it } from 'vitest';
import type { PlayerStat } from '@/types';
import { parseJsonReply, parseOwnerBlocks, parseOwnerLines, parsePlainLines, scoreChanges, type Owner } from './entity-stats-score';

const stat = (id: string, name: string): PlayerStat =>
  ({ id, name, type: 'number', min: 0, max: 100, value: 50, description: '', descriptors: [] } as unknown as PlayerStat);
const player: Owner = { key: 'player', name: 'Player Character', stats: [stat('p-vigor', 'Vigor'), stat('p-resolve', 'Resolve')] };
const bram: Owner = { key: 'ent-bram', name: 'Bram', stats: [stat('b-vigor', 'Vigor'), stat('b-trust', 'Trust')] };
const owners = [player, bram];

describe('parsers', () => {
  it('reads plain lines through the app reader and counts unknown stats', () => {
    const parsed = parsePlainLines('Vigor: -5\nMana: -2', player);
    expect(parsed.changes).toEqual([{ owner: 'player', stat: 'Vigor', change: -5 }]);
    expect(parsed.invalid).toBe(1);
  });

  it('routes owner lines to the named owner', () => {
    const parsed = parseOwnerLines('Bram / Vigor: -6\n- **Player Character** / Vigor: -4\nNobody / Vigor: 1', owners);
    expect(parsed.changes).toEqual([
      { owner: 'player', stat: 'Vigor', change: -4 },
      { owner: 'ent-bram', stat: 'Vigor', change: -6 },
    ]);
    expect(parsed.invalid).toBe(1);
  });

  it('routes an owner written with a colon or a space and rejects a line with no owner', () => {
    const parsed = parseOwnerLines('Bram: Vigor: -3\nBram Trust: 2\nVigor: -5\nBramble / Vigor: 1', owners);
    expect(parsed.changes).toEqual([
      { owner: 'ent-bram', stat: 'Vigor', change: -3 },
      { owner: 'ent-bram', stat: 'Trust', change: 2 },
    ]);
    expect(parsed.invalid).toBe(2);
  });

  it('reads owner blocks and rejects a stat line before any owner', () => {
    const parsed = parseOwnerBlocks('Vigor: -1\n### Bram\nVigor: -6\n**Player Character:**\nVigor: -4', owners);
    expect(parsed.changes).toEqual([
      { owner: 'player', stat: 'Vigor', change: -4 },
      { owner: 'ent-bram', stat: 'Vigor', change: -6 },
    ]);
    expect(parsed.invalid).toBe(1);
  });

  it('keeps every JSON row and flags a stat outside the owner', () => {
    const parsed = parseJsonReply('{"Bram":[{"stat":"Vigor","change":-3},{"stat":"Vigor","change":-3},{"stat":"Resolve","change":2}],"Player Character":[]}', owners);
    expect(parsed.changes).toHaveLength(2);
    expect(parsed.invalid).toBe(1);
  });

  it('reads a stat map, dropping zeros and flagging a stat outside the owner', () => {
    const parsed = parseJsonReply('{"Player Character":{"Vigor":-4,"Resolve":0},"Bram":{"Vigor":0,"Mana":3}}', owners);
    expect(parsed.changes).toEqual([{ owner: 'player', stat: 'Vigor', change: -4 }]);
    expect(parsed.invalid).toBe(1);
  });

  it('reads a change that sits beside its evidence', () => {
    const parsed = parseJsonReply('{"Bram":{"Vigor":{"evidence":"hauls alone","change":-6},"Trust":{"evidence":"none","change":0}}}', owners);
    expect(parsed.changes).toEqual([{ owner: 'ent-bram', stat: 'Vigor', change: -6 }]);
    expect(parsed.invalid).toBe(0);
  });

  it('marks broken JSON unreadable', () => {
    expect(parseJsonReply('{"Bram":[', owners).unreadable).toBe(true);
  });
});

describe('scoreChanges', () => {
  const scope = ['player', 'ent-bram'];
  const expectBram = { 'ent-bram': { Vigor: '-' as const } };

  it('grades an exact reply', () => {
    const score = scoreChanges([{ owner: 'ent-bram', stat: 'Vigor', change: -5 }], expectBram, {}, scope);
    expect(score).toMatchObject({ expected: 1, hits: 1, spurious: 0, exact: true });
  });

  it('counts the same stat on the wrong owner as misattributed', () => {
    const score = scoreChanges([{ owner: 'player', stat: 'Vigor', change: -5 }], expectBram, {}, scope);
    expect(score).toMatchObject({ hits: 0, misses: 1, spurious: 1, misattributed: 1, exact: false });
  });

  it('names each missed and spurious cell with its direction', () => {
    const score = scoreChanges([{ owner: 'player', stat: 'Vigor', change: -5 }, { owner: 'ent-bram', stat: 'Vigor', change: 3 }], expectBram, {}, scope);
    expect(score).toMatchObject({ missedCells: ['ent-bram/Vigor-'], spuriousCells: ['player/Vigor-'] });
  });

  it('separates a wrong sign from a miss', () => {
    expect(scoreChanges([{ owner: 'ent-bram', stat: 'Vigor', change: 4 }], expectBram, {}, scope).wrongSign).toBe(1);
    expect(scoreChanges([], expectBram, {}, scope).misses).toBe(1);
  });

  it('lets an allowed move through only in its direction', () => {
    const allow = { 'ent-bram': { Trust: '+' as const } };
    const up = [{ owner: 'ent-bram', stat: 'Vigor', change: -5 }, { owner: 'ent-bram', stat: 'Trust', change: 2 }];
    const down = [{ owner: 'ent-bram', stat: 'Vigor', change: -5 }, { owner: 'ent-bram', stat: 'Trust', change: -2 }];
    expect(scoreChanges(up, expectBram, allow, scope).exact).toBe(true);
    expect(scoreChanges(down, expectBram, allow, scope).spurious).toBe(1);
  });

  it('counts duplicate rows and sums them', () => {
    const rows = [{ owner: 'ent-bram', stat: 'Vigor', change: -3 }, { owner: 'ent-bram', stat: 'Vigor', change: -3 }];
    expect(scoreChanges(rows, expectBram, {}, scope)).toMatchObject({ duplicates: 1, hits: 1 });
  });

  it('grades only owners in scope', () => {
    const score = scoreChanges([{ owner: 'ent-bram', stat: 'Trust', change: 5 }], expectBram, {}, ['player']);
    expect(score).toMatchObject({ expected: 0, spurious: 0, exact: true });
  });
});
