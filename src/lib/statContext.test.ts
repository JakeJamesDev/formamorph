import { describe, it, expect } from 'vitest';
import { activeDescriptor, buildStatContext } from './statContext';
import type { PlayerStat, Stat, StatGroup } from '@/types';

// A minimal PlayerStat; Vigor at 62/100 sits above the 50-threshold descriptor, so "Winded" applies.
const vigor = {
  id: 'v', name: 'Vigor', type: 'number', description: 'Physical stamina.', min: 0, max: 100, value: 62, regen: 0,
  descriptors: [{ id: 'd', threshold: 100, description: 'Winded' }],
} as unknown as PlayerStat;

// A percentage stat renders its value as N% instead of value/max.
const focus = {
  id: 'f', name: 'Focus', type: 'percentage', description: 'Mental sharpness.', min: 0, max: 100, value: 40, regen: 0,
  descriptors: [{ id: 'd', threshold: 100, description: 'Sharp' }],
} as unknown as PlayerStat;

// The same stat as hand-edited or third-party world JSON delivers it: the descriptors array the type calls
// required is simply not there. It reaches a live turn, not just the editor, so it has a status to omit
// rather than a prompt to take down.
const bandless = {
  id: 'v', name: 'Vigor', type: 'number', description: 'Physical stamina.', min: 0, max: 100, value: 62, regen: 0,
} as unknown as PlayerStat;

const all = { values: true, status: true, meaning: true };

describe('buildStatContext', () => {
  it('values only → name and value/max', () => {
    expect(buildStatContext([vigor], { values: true, status: false, meaning: false })).toBe('Vigor: 62/100');
  });
  it('meaning only → name and description, no numbers', () => {
    expect(buildStatContext([vigor], { values: false, status: false, meaning: true })).toBe('Vigor: Physical stamina.');
  });
  it('status only → bare descriptor (no parentheses when alone)', () => {
    expect(buildStatContext([vigor], { values: false, status: true, meaning: false })).toBe('Vigor: Winded');
  });
  it('values + status → descriptor parenthesized after the value', () => {
    expect(buildStatContext([vigor], { values: true, status: true, meaning: false })).toBe('Vigor: 62/100 (Winded)');
  });
  it('all pieces → value, (status), then — meaning', () => {
    expect(buildStatContext([vigor], all)).toBe('Vigor: 62/100 (Winded) — Physical stamina.');
  });
  it('no pieces → just the name', () => {
    expect(buildStatContext([vigor], { values: false, status: false, meaning: false })).toBe('Vigor');
  });
  it('markdown bullets each line with a bold name', () => {
    expect(buildStatContext([vigor], { values: true, status: false, meaning: true }, 'markdown'))
      .toBe('- **Vigor:** 62/100 — Physical stamina.');
  });
  it('markdown with no pieces → bold name only', () => {
    expect(buildStatContext([vigor], { values: false, status: false, meaning: false }, 'markdown')).toBe('- **Vigor**');
  });
  it('omits meaning when the stat has no description', () => {
    const bare = { ...vigor, description: '' } as PlayerStat;
    expect(buildStatContext([bare], all)).toBe('Vigor: 62/100 (Winded)');
  });
  it('xml → one <stat> with a nested child tag per selected piece', () => {
    expect(buildStatContext([vigor], all, 'xml')).toBe(
      '<stat>\n  <name>Vigor</name>\n  <value>62/100</value>\n  <status>Winded</status>\n  <meaning>Physical stamina.</meaning>\n</stat>',
    );
  });
  it('xml with no pieces → just the <name> child', () => {
    expect(buildStatContext([vigor], { values: false, status: false, meaning: false }, 'xml')).toBe(
      '<stat>\n  <name>Vigor</name>\n</stat>',
    );
  });
  it('xml escapes markup in values', () => {
    const amp = { ...vigor, name: 'H<P & M', description: '' } as PlayerStat;
    expect(buildStatContext([amp], { values: false, status: false, meaning: false }, 'xml')).toBe(
      '<stat>\n  <name>H&lt;P &amp; M</name>\n</stat>',
    );
  });
  it('rounds a time-scaled fractional value to a whole number', () => {
    // Regen scaled by a measured 35-minute turn put 0.5833333333333333 straight into the prompt — a
    // parrotable numeral the model echoes back, and pure token waste.
    const charge = { ...vigor, name: 'Charge', value: 35 / 60 } as PlayerStat;
    expect(buildStatContext([charge], { values: true, status: false, meaning: false })).toBe('Charge: 1/100');
    const fractionalMax = { ...vigor, value: 85.5, max: 90.4 } as PlayerStat;
    expect(buildStatContext([fractionalMax], { values: true, status: false, meaning: false })).toBe('Vigor: 86/90');
    const pct = { ...focus, value: 40.6 } as PlayerStat;
    expect(buildStatContext([pct], { values: true, status: false, meaning: false })).toBe('Focus: 41%');
  });
  it('percentage stat renders its value as N%', () => {
    expect(buildStatContext([focus], { values: true, status: false, meaning: false })).toBe('Focus: 40%');
  });
  it('percentage value + status → descriptor parenthesized after the percent', () => {
    expect(buildStatContext([focus], { values: true, status: true, meaning: false })).toBe('Focus: 40% (Sharp)');
  });
  it('a stat carrying no descriptors at all renders every other piece and omits the status', () => {
    expect(buildStatContext([bandless], all)).toBe('Vigor: 62/100 — Physical stamina.');
    expect(buildStatContext([bandless], { values: false, status: true, meaning: false })).toBe('Vigor');
  });
  it('an absent descriptors array reads exactly as an empty one, in every format', () => {
    const empty = { ...bandless, descriptors: [] } as PlayerStat;
    for (const format of ['simple', 'markdown', 'xml'] as const) {
      expect(buildStatContext([bandless], all, format)).toBe(buildStatContext([empty], all, format));
    }
    expect(buildStatContext([bandless], all, 'xml')).toBe(
      '<stat>\n  <name>Vigor</name>\n  <value>62/100</value>\n  <meaning>Physical stamina.</meaning>\n</stat>',
    );
  });
  it('percentage renders as N% in xml', () => {
    expect(buildStatContext([focus], { values: true, status: false, meaning: false }, 'xml')).toBe(
      '<stat>\n  <name>Focus</name>\n  <value>40%</value>\n</stat>',
    );
  });
});

describe('buildStatContext with stat groups', () => {
  const stat = (id: string, name: string, groupId: string | null, order: number) =>
    ({ ...bandless, id, name, description: '', groupId, order }) as PlayerStat;
  const values = { values: true, status: false, meaning: false };
  // Body holds a nested Wounds group, then Vigor; Mind holds Focus; Gear holds only the Load subgroup; Empty holds nothing.
  const groups: StatGroup[] = [
    { id: 'body', name: 'Body', aiDescription: 'What the body can take.', parentId: null, order: 1 },
    { id: 'wounds', name: 'Wounds', aiDescription: '', parentId: 'body', order: 0 },
    { id: 'mind', name: 'Mind', aiDescription: '', parentId: null, order: 2 },
    { id: 'gear', name: 'Gear', aiDescription: '', parentId: null, order: 3 },
    { id: 'load', name: 'Load', aiDescription: 'What the pack weighs.', parentId: 'gear', order: 0 },
    { id: 'empty', name: 'Empty', aiDescription: 'Nothing here.', parentId: null, order: 4 },
  ];
  const authored = [
    stat('luck', 'Luck', null, 0), stat('vigor', 'Vigor', 'body', 1), stat('bleed', 'Bleed', 'wounds', 0),
    stat('focus', 'Focus', 'mind', 0), stat('pack', 'Pack', 'load', 0), stat('grit', 'Grit', null, 5),
  ];

  it('renders loose stats first, then each group under its heading, nested subgroups indented', () => {
    expect(buildStatContext(authored, values, 'simple', { groups, authored })).toBe([
      'Luck: 62/100', 'Grit: 62/100',
      'Body:', '  What the body can take.', '  Vigor: 62/100',
      '  Wounds:', '    Bleed: 62/100',
      'Mind:', '  Focus: 62/100',
      'Gear:', '  Load:', '    What the pack weighs.', '    Pack: 62/100',
    ].join('\n'));
  });

  it('nests markdown bullets under a bold group bullet carrying its description', () => {
    expect(buildStatContext(authored, values, 'markdown', { groups, authored })).toBe([
      '- **Luck:** 62/100', '- **Grit:** 62/100',
      '- **Body:** What the body can take.', '  - **Vigor:** 62/100',
      '  - **Wounds:**', '    - **Bleed:** 62/100',
      '- **Mind:**', '  - **Focus:** 62/100',
      '- **Gear:**', '  - **Load:** What the pack weighs.', '    - **Pack:** 62/100',
    ].join('\n'));
  });

  it('nests xml <stat> tags inside <group> tags with a name and a description', () => {
    const only = authored.filter((s) => ['vigor', 'bleed'].includes(s.id));
    expect(buildStatContext(only, values, 'xml', { groups: [{ ...groups[0], name: 'Body & Soul' }, groups[1]], authored })).toBe([
      '<group>', '  <name>Body &amp; Soul</name>', '  <description>What the body can take.</description>',
      '  <stat>', '    <name>Vigor</name>', '    <value>62/100</value>', '  </stat>',
      '  <group>', '    <name>Wounds</name>',
      '    <stat>', '      <name>Bleed</name>', '      <value>62/100</value>', '    </stat>',
      '  </group>',
      '</group>',
    ].join('\n'));
  });

  it('drops a group whose subtree holds none of the given stats', () => {
    const out = buildStatContext([authored[3]], values, 'simple', { groups, authored });
    expect(out).toBe('Mind:\n  Focus: 62/100');
  });

  it('places a stat where the author put it, not where its live copy says', () => {
    // A save made before a regrouping still carries Focus in Body.
    const stale = { ...authored[3], groupId: 'body' } as PlayerStat;
    expect(buildStatContext([stale], values, 'simple', { groups, authored })).toBe('Mind:\n  Focus: 62/100');
  });

  it('lists a stat the authored list lacks with the loose stats', () => {
    const extra = stat('extra', 'Extra', 'body', 0);
    expect(buildStatContext([authored[1], extra], values, 'simple', { groups, authored }))
      .toBe('Extra: 62/100\nBody:\n  What the body can take.\n  Vigor: 62/100');
  });

  it('sends a hidden group\'s stats as loose stats and lifts its subgroup one level, heading kept', () => {
    const hidden = groups.map((g) => (g.id === 'body' ? { ...g, aiVisible: false } : g));
    expect(buildStatContext(authored, values, 'simple', { groups: hidden, authored })).toBe([
      'Luck: 62/100', 'Vigor: 62/100', 'Grit: 62/100',
      'Wounds:', '  Bleed: 62/100',
      'Mind:', '  Focus: 62/100',
      'Gear:', '  Load:', '    What the pack weighs.', '    Pack: 62/100',
    ].join('\n'));
  });

  it('folds a hidden nested group\'s stats into its parent in every format', () => {
    const hidden = groups.map((g) => (g.id === 'load' ? { ...g, aiVisible: false } : g));
    const pack = authored.filter((s) => s.id === 'pack');
    const placement = { groups: hidden, authored };
    expect(buildStatContext(pack, values, 'simple', placement)).toBe('Gear:\n  Pack: 62/100');
    expect(buildStatContext(pack, values, 'markdown', placement)).toBe('- **Gear:**\n  - **Pack:** 62/100');
    expect(buildStatContext(pack, values, 'xml', placement)).toBe([
      '<group>', '  <name>Gear</name>', '  <stat>', '    <name>Pack</name>', '    <value>62/100</value>', '  </stat>', '</group>',
    ].join('\n'));
  });

  it('renders groups marked visible exactly as groups with no mark', () => {
    const marked = groups.map((g) => ({ ...g, aiVisible: true }));
    for (const format of ['simple', 'markdown', 'xml'] as const) {
      expect(buildStatContext(authored, values, format, { groups: marked, authored }))
        .toBe(buildStatContext(authored, values, format, { groups, authored }));
    }
  });

  it('renders a world with no groups byte for byte as the flat list, in the given order', () => {
    const flat = [stat('b', 'Beta', null, 1), stat('a', 'Alpha', null, 0), { ...vigor, groupId: null }] as PlayerStat[];
    // The output before stat groups reached the prompt.
    const before = {
      simple: 'Beta: 62/100\nAlpha: 62/100\nVigor: 62/100 (Winded) — Physical stamina.',
      markdown: '- **Beta:** 62/100\n- **Alpha:** 62/100\n- **Vigor:** 62/100 (Winded) — Physical stamina.',
      xml: [
        '<stat>\n  <name>Beta</name>\n  <value>62/100</value>\n</stat>',
        '<stat>\n  <name>Alpha</name>\n  <value>62/100</value>\n</stat>',
        '<stat>\n  <name>Vigor</name>\n  <value>62/100</value>\n  <status>Winded</status>\n  <meaning>Physical stamina.</meaning>\n</stat>',
      ].join('\n'),
    };
    for (const format of ['simple', 'markdown', 'xml'] as const) {
      expect(buildStatContext(flat, all, format, { groups: [], authored: flat })).toBe(before[format]);
      expect(buildStatContext(flat, all, format)).toBe(before[format]);
    }
  });
});

describe('activeDescriptor threshold units', () => {
  // Ten rockets banded 3/6/10: the exact world the raw reading exists for.
  const rockets = {
    id: 'r', name: 'Rockets', type: 'number', description: '', min: 0, max: 10, regen: 0,
    descriptors: [
      { id: 'd1', threshold: 3, description: 'low' },
      { id: 'd2', threshold: 6, description: 'stocked' },
      { id: 'd3', threshold: 10, description: 'full' },
    ],
  } as unknown as Stat;

  it('reads thresholds as raw stat values when the stat carries no unit field', () => {
    expect(activeDescriptor(rockets, 0)?.description).toBe('low');
    expect(activeDescriptor(rockets, 3)?.description).toBe('low');
    expect(activeDescriptor(rockets, 4)?.description).toBe('stocked');
    expect(activeDescriptor(rockets, 10)?.description).toBe('full');
  });

  it('reads them the same way when the field says so explicitly', () => {
    const explicit = { ...rockets, thresholdUnit: 'raw' } as Stat;
    for (const value of [0, 3, 4, 6, 10]) {
      expect(activeDescriptor(explicit, value)?.description).toBe(activeDescriptor(rockets, value)?.description);
    }
  });

  it('reads them as a share of min→max in percent mode — the engine’s pre-feature behavior', () => {
    const proportional = { ...rockets, thresholdUnit: 'percent' } as Stat;
    // 3/6/10 as percentages put the bands at 0.3 / 0.6 / 1 rocket, which is what the old reading did.
    expect(activeDescriptor(proportional, 0)?.description).toBe('low');
    expect(activeDescriptor(proportional, 1)?.description).toBe('full');
    expect(activeDescriptor(proportional, 2)).toBeUndefined();
  });

  it('bands a 0–100 stat identically under either unit, which is why no stored world moves', () => {
    const vigor = {
      ...rockets, max: 100,
      descriptors: [{ id: 'd1', threshold: 30, description: 'weak' }, { id: 'd2', threshold: 100, description: 'hale' }],
    } as Stat;
    const percent = { ...vigor, thresholdUnit: 'percent' } as Stat;
    for (const value of [0, 29, 30, 31, 99, 100]) {
      expect(activeDescriptor(vigor, value)?.description).toBe(activeDescriptor(percent, value)?.description);
    }
  });

  it('measures a percent band from min, not from zero', () => {
    const shifted = {
      ...rockets, min: 20, max: 40, thresholdUnit: 'percent',
      descriptors: [{ id: 'd1', threshold: 50, description: 'half' }, { id: 'd2', threshold: 100, description: 'brimming' }],
    } as Stat;
    expect(activeDescriptor(shifted, 30)?.description).toBe('half');
    expect(activeDescriptor(shifted, 31)?.description).toBe('brimming');
  });

  it('keeps a raw band put when min is not zero', () => {
    const shifted = {
      ...rockets, min: 20, max: 40,
      descriptors: [{ id: 'd1', threshold: 30, description: 'half' }, { id: 'd2', threshold: 40, description: 'brimming' }],
    } as Stat;
    expect(activeDescriptor(shifted, 30)?.description).toBe('half');
    expect(activeDescriptor(shifted, 31)?.description).toBe('brimming');
  });

  it('reads a Percentage stat’s thresholds as percents without any unit field', () => {
    const focusStat = {
      ...rockets, type: 'percentage', min: 0, max: 100,
      descriptors: [{ id: 'd1', threshold: 40, description: 'scattered' }, { id: 'd2', threshold: 100, description: 'sharp' }],
    } as Stat;
    expect(activeDescriptor(focusStat, 40)?.description).toBe('scattered');
    expect(activeDescriptor(focusStat, 41)?.description).toBe('sharp');
  });
});
