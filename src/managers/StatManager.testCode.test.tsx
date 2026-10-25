import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Entity, Placeholder, Stat, Trait } from '@/types';
import type { CodeTemplate } from '@/lib/statCodeTemplates';
import type { CodeEntityNames, CodeTraitPlace } from '@/lib/statCodeAnalysis';
import type { CodeWorldLookup } from '@/lib/codeWorldLookup';
import { encodePlaceholderToken } from '@/lib/placeholders';
import StatManager, { type StatEditorStore } from './StatManager';
import { offWorldOf } from '@/lib/scriptBoxHome';
import { boxScripts } from '@/test/scriptFixtures';

/** Running the code and reading it are two different answers about the same text, and the panel has to
 *  show both. The editor itself is stubbed — what's under test is the row beneath it. */

const stats = [
  { id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10 },
  { id: 's2', name: 'Damp', type: 'number', value: 3, min: 0, max: 10 },
] as unknown as Stat[];

// The third name carries a chip, so the run has to key it on the placeholder's own name.
const beast = { id: 'p1', name: 'Beast', values: [] } as unknown as Placeholder;
const FURY = `${encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'pl1' })} Fury`;
const traits = [
  { id: 't1', name: 'Brave', statChanges: [] },
  { id: 't2', name: 'Night Owl', statChanges: [] },
  { id: 't3', name: FURY, statChanges: [] },
] as Trait[];

// Mira can be played and Ash cannot, so only Mira's trait is a persona trait. Ash owns a switched-off stat.
const ashStock = { id: 'a1', name: 'Stock', type: 'number', value: 4, min: 0, max: 10, regen: 0, description: '', enabled: false } as Stat;
const entities = [
  { id: 'e1', name: 'Mira', persona: true, traits: [{ id: 't4', name: 'Scarred', statChanges: [] }] },
  { id: 'e2', name: 'Ash', traits: [{ id: 't5', name: 'Loyal', statChanges: [] }], stats: [ashStock] },
] as Entity[];

/** The seed fields turn one adds to a stat with min 0, max 10 and no regen. */
const BASES = { baseMin: 0, baseMax: 10, baseRegen: 0, aiMaxDelta: 0 };
/** `stats` as turn one seeds them (Q3). */
const SEEDED = [{ ...stats[0], starting: 7, ...BASES }, { ...stats[1], starting: 3, ...BASES }];

/** The executor's `persona` when none plays. */
const NO_PERSONA = { id: '', name: '', type: '', pronouns: '', inScene: false, traits: [] };

const updateStat = vi.fn();
/** What a case adds to the mocked world, such as Blueprint stats. */
const worldExtra = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
/** True for a case in the library entity editor, which has no world. */
const noWorld = vi.hoisted(() => ({ current: false }));
vi.mock('@/contexts/GameDataContext', () => {
  const world = () => ({
    updateStat, stats, statGroups: [], playStats: stats, placeholders: [beast], worldPlaceholders: [beast], traits, traitGroups: [], entities, playEntities: entities,
    ...worldExtra.current,
  });
  return { useGameData: world, useGameDataOptional: () => (noWorld.current ? null : world()) };
});
vi.mock('@/lib/useBodyMorphNames', () => ({
  useBodyMorphSources: () => ({ sources: [], loading: false, load: vi.fn() }),
  useOwnerMorphSources: () => ({ sources: [], loading: false, load: vi.fn() }),
}));
vi.mock('@/components/prompt/PlaceholderField', () => ({
  PlaceholderNameField: (props: { value?: string }) => <input aria-label="Name" defaultValue={props.value} />,
}));

/** What each box handed the editor last render, by the editor's label. The completions and the underlines
 *  are the editor's own, so what the panel passes it is all the panel can be held to. */
const editorProps = vi.hoisted(() => new Map<string, Record<string, unknown>>());

// A plain textarea over the same value: the real editor arrives on its own chunk and brings CodeMirror
// with it, and neither is what this file is about.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; onChange: (next: string) => void; ariaLabel: string }) => {
    // The panel passes more than the three props this stub renders, and the case below reads those.
    // Re-set last, so the latest render's box is the last of its timing.
    editorProps.delete(props.ariaLabel);
    editorProps.set(props.ariaLabel, props as unknown as Record<string, unknown>);
    return (
      <textarea
        aria-label={props.ariaLabel}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    );
  },
}));

/** The author's saved templates, as the template menu lists them. */
const userTemplates = vi.hoisted((): CodeTemplate[] => []);
vi.mock('@/services/StatTemplateStorageService', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/services/StatTemplateStorageService')>(),
  listUserTemplates: async () => [...userTemplates],
}));

const executeStatCode = vi.hoisted(() => vi.fn());
// Only the run is faked; the editor's reader still imports the executor's real surface lists.
vi.mock('@/lib/statCodeExecutor', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/statCodeExecutor')>(),
  executeStatCode,
}));

type Box = 'Before the AI' | 'After the AI';

/** A blank name reads as the stat and timing, so each box's controls end in its timing. */
const boxName = (box: Box) => new RegExp(` · ${box}$`);
const testButton = (box: Box) => new RegExp(`^Test Code .* · ${box}$`);
const templatesButton = (box: Box) => new RegExp(`^Templates .* · ${box}$`);
const fieldOf = (box: Box) => screen.getByLabelText(new RegExp(`^Code .* · ${box}$`));
/** What the latest panel handed one box's editor. */
const propsOf = (box: Box) => [...editorProps].filter(([label]) => label.startsWith('Code ') && boxName(box).test(label)).at(-1)![1];

/** The report beside one box's Test Code button. The button and its report share a row, so the row is
 *  the button's grandparent: the buttons sit in a group of their own inside it. */
const row = (box: Box = 'After the AI') =>
  screen.getByRole('button', { name: testButton(box) }).parentElement?.parentElement as HTMLElement;

/** A stat with a script of each timing: blank where it held none, as an author who added both would leave it. */
const withBoxes = (stat: Stat): Stat => {
  const scripts = stat.scripts ?? [];
  const missing = (['before', 'after'] as const).filter((timing) => !scripts.some((script) => script.timing === timing));
  return { ...stat, scripts: [...scripts, ...missing.map((timing) => ({ id: timing, timing, code: '' }))] };
};

/** Ash holding `held` in the world, and the store his Stats tab hands the panel: the stats the world holds. */
function ashHolding(held: Stat[]): StatEditorStore {
  const ash = { ...entities[1], stats: held };
  worldExtra.current = { ...worldExtra.current, entities: [entities[0], ash], playEntities: [entities[0], ash] };
  return { stats: held, updateStat, ownerId: ash.id, offWorld: offWorldOf(ash) };
}

/** The code editor lives on the panel's Scripts tab, so every case here opens there. The tab an author picks
 *  belongs to the editor, which is why it arrives as a prop rather than being clicked to. */
const renderCodePanel = (stat: Stat) => render(<StatManager stat={withBoxes(stat)} tab="code" onTabChange={() => {}} />);

/** Put code in one box the way an author would, and run that box. */
async function testCode(
  user: ReturnType<typeof userEvent.setup>, code: string, box: Box = 'After the AI',
) {
  const field = fieldOf(box);
  await user.clear(field);
  await user.paste(code);
  await user.click(screen.getByRole('button', { name: testButton(box) }));
}

describe('what each box completes and checks against', () => {
  /** What one box hands the editor, as the options its reader and its completions take. */
  const optionsOf = (box: Box) => {
    const props = propsOf(box);
    return {
      statNames: props.statNames as string[],
      selfName: props.selfName as string,
      placeholders: props.placeholders as { list: Placeholder[] },
      // The editor's session reads the traits' names; their groups are the Variable menu's.
      traits: (props.traits as CodeTraitPlace[]).map((trait) => trait.name),
      entities: props.entities as CodeEntityNames[],
    };
  };

  it('hands both editors the same names, so a lookup reads alike in either box', () => {
    renderCodePanel(stats[0]);
    expect(optionsOf('Before the AI')).toEqual(optionsOf('After the AI'));
    // Not vacuously equal: the world's stats and traits are actually in there.
    expect(optionsOf('Before the AI').statNames).toEqual(['Warmth', 'Damp']);
    expect(optionsOf('Before the AI').selfName).toBe('Warmth');
    expect(optionsOf('Before the AI').traits).toEqual(['Brave', 'Night Owl', 'Beast Fury']);
    expect(optionsOf('Before the AI').entities).toEqual([
      { id: 'e1', name: 'Mira', type: '', pronouns: '', persona: true, traits: [{ id: 't4', name: 'Scarred', path: [], tabPosition: 0 }], folder: [], tabPosition: 0 },
      {
        id: 'e2', name: 'Ash', type: '', pronouns: '', persona: false, traits: [{ id: 't5', name: 'Loyal', path: [], tabPosition: 0 }], stats: ['Stock'],
        folder: [], tabPosition: 1,
      },
    ]);
  });

  // The acceptance case, run through the real reader and the real completion source rather than compared
  // prop by prop: a typo underlines in the before box and the world's own name does not, exactly as after.
  it('underlines an unknown stat in either box, and completes the real one there', async () => {
    const { statCodeCompletions, statCodeDiagnostics } = await import('@/lib/statCodeAnalysis');
    renderCodePanel(stats[0]);
    for (const box of ['Before the AI', 'After the AI'] as const) {
      const options = optionsOf(box);
      const typo = statCodeDiagnostics('return stats["Vigour"].value;', options);
      expect([box, typo.map((d) => d.message)]).toEqual([box, [expect.stringContaining('Vigour')]]);
      expect([box, statCodeDiagnostics('return stats["Damp"].value;', options)]).toEqual([box, []]);

      const code = 'return stats[""];';
      const offered = statCodeCompletions(code, code.indexOf('""') + 1, options)?.options.map((o) => o.label);
      expect([box, offered]).toEqual([box, expect.arrayContaining(['Warmth', 'Damp'])]);
    }
  });

  // The panel hands each box its own name, so the reader can tell a write to another stat from one to self.
  it('takes a write to another stat in either box, underlines an unknown name on the write side, and completes the four fields', async () => {
    const { statCodeCompletions, statCodeDiagnostics } = await import('@/lib/statCodeAnalysis');
    renderCodePanel(stats[0]);
    for (const box of ['Before the AI', 'After the AI'] as const) {
      const options = optionsOf(box);
      expect([box, statCodeDiagnostics('stats.Damp.value += 1;\nstats["Damp"].max = 12;', options)]).toEqual([box, []]);
      const typo = statCodeDiagnostics('stats.Dmap.value = 1;', options);
      expect([box, typo.map((d) => d.message)]).toEqual([box, [expect.stringContaining('Dmap')]]);

      const code = 'stats.Damp.';
      const offered = statCodeCompletions(code, code.length, options)?.options.map((o) => o.label);
      expect([box, offered]).toEqual([box, expect.arrayContaining(['value', 'min', 'max', 'regen'])]);
    }
  });
});

describe('whose code a box holds', () => {
  const ownerOf = (box: Box) => propsOf(box).owner;
  const worldNamesOf = (box: Box) => propsOf(box).statNames;
  const hub = { id: 'o1', name: 'Hub', type: 'number', value: 1, min: 0, max: 5, regen: 0, description: '', descriptors: [] } as Stat;
  const grit = { id: 'o2', name: 'Grit', type: 'number', value: 4, min: 0, max: 8, regen: 0, description: '', descriptors: [] } as Stat;

  beforeEach(() => { worldExtra.current = {}; });

  it('gives a world stat no owner, and its own world’s stats under Stats', () => {
    renderCodePanel(stats[0]);
    for (const box of ['Before the AI', 'After the AI'] as const) {
      expect([box, ownerOf(box)]).toEqual([box, null]);
      expect([box, worldNamesOf(box)]).toEqual([box, ['Warmth', 'Damp']]);
    }
  });

  it('gives an entity stat its entity as owner, with its own stats, and still lists the world’s under Stats', () => {
    render(<StatManager stat={withBoxes(hub)} tab="code" onTabChange={() => {}} store={ashHolding([hub, grit])} />);
    for (const box of ['Before the AI', 'After the AI'] as const) {
      expect([box, ownerOf(box)]).toEqual([box, {
        kind: 'entity',
        entity: expect.objectContaining({ id: 'e2', name: 'Ash', stats: ['Hub', 'Grit'], traits: [expect.objectContaining({ name: 'Loyal' })] }),
      }]);
      expect([box, worldNamesOf(box)]).toEqual([box, ['Warmth', 'Damp']]);
    }
  });

  it('binds each box’s card lookup to the stat and its owner', () => {
    const lookupOf = (box: Box) => propsOf(box).lookup as CodeWorldLookup;
    renderCodePanel(stats[0]);
    expect(lookupOf('After the AI').self()).toMatchObject({ stat: { id: 's1', name: 'Warmth' }, scope: 'global', owners: [] });
    expect(lookupOf('After the AI').owner()).toEqual({ kind: 'empty' });

    render(<StatManager stat={withBoxes(hub)} tab="code" onTabChange={() => {}} store={ashHolding([hub, grit])} />);
    for (const box of ['Before the AI', 'After the AI'] as const) {
      expect([box, lookupOf(box).self()]).toEqual([box, expect.objectContaining({ stat: expect.objectContaining({ id: 'o1' }), owners: ['Ash'], entityId: 'e2' })]);
      expect([box, lookupOf(box).owner()]).toEqual([box, {
        kind: 'entity',
        entity: expect.objectContaining({ entity: expect.objectContaining({ id: 'e2' }), traits: ['Loyal'] }),
      }]);
      expect([box, lookupOf(box).stat({ route: 'world' }, 'Damp')?.scope]).toEqual([box, 'global']);
      // The box hands its lookup the world's traits, so trait cards show their rows.
      expect([box, lookupOf(box).trait({ route: 'owner' }, 'Loyal')?.owners]).toEqual([box, ['Ash']]);
    }
  });

  it('gives the library’s boxes no lookup', () => {
    noWorld.current = true;
    try {
      render(<StatManager stat={withBoxes(hub)} tab="code" onTabChange={() => {}} store={ashHolding([hub, grit])} />);
      for (const box of ['Before the AI', 'After the AI'] as const) {
        expect([box, propsOf(box).lookup]).toEqual([box, undefined]);
      }
    } finally {
      noWorld.current = false;
    }
  });

  it('gives a Blueprint stat its group’s stats as the owner’s, and the world’s play stats under Stats', () => {
    const blueprints = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
    const social = { id: 'bp-social', name: 'Social', parentId: 'bp' };
    const fear = { ...hub, id: 'f', name: 'Fear', groupId: 'bp-social' } as Stat;
    const calm = { ...grit, id: 'c', name: 'Calm', groupId: 'bp-social' } as Stat;
    const lone = { ...grit, id: 'l', name: 'Lone', groupId: 'bp' } as Stat;
    worldExtra.current = { stats: [...stats, fear, calm, lone], statGroups: [blueprints, social] };
    renderCodePanel(fear);
    for (const box of ['Before the AI', 'After the AI'] as const) {
      expect([box, ownerOf(box)]).toEqual([box, { kind: 'blueprint', statNames: ['Fear', 'Calm'] }]);
      expect([box, worldNamesOf(box)]).toEqual([box, ['Warmth', 'Damp']]);
    }
  });
});

describe('what Test Code reports', () => {
  beforeEach(() => {
    worldExtra.current = {};
    executeStatCode.mockReset();
    updateStat.mockReset();
  });

  it('says how many problems the reader found beside the number the run produced', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null });
    renderCodePanel(stats[0]);

    // Runs perfectly — the branch holding the typo is never taken, which is exactly why running it
    // proves nothing about the typo.
    await testCode(user, 'if (false) { return nope; } return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5'));
    await waitFor(() => expect(row()).toHaveTextContent('1 error in this code'));
  });

  it('runs over the world’s stats and counts a stat name the world does not have', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 3, error: null });
    renderCodePanel(stats[0]);

    // Damp is in the world and Warmth is this stat's own entry; Dmap is a typo.
    await testCode(user, 'stats.Warmth.value = stats.Damp.value; return stats.Dmap.value;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 3'));
    await waitFor(() => expect(row()).toHaveTextContent('1 error in this code'));
    // Each stat at its opening number, a copy of the world's (Q8), seeded by the opening fold as play seeds it (Q3).
    expect(executeStatCode.mock.calls[0][1]).toEqual(SEEDED);
  });

  it('reads an owned stat’s code against the owner’s stats under owner.stats and the world’s under stats', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 1, error: null });
    const hub = { id: 'o1', name: 'Hub', type: 'number', value: 1, min: 0, max: 5, regen: 0, description: '', descriptors: [] } as Stat;
    const grit = { ...hub, id: 'o2', name: 'Grit' } as Stat;
    render(<StatManager stat={withBoxes(hub)} tab="code" onTabChange={() => {}} store={ashHolding([hub, grit])} />);

    // Grit is the owner's and Damp is the world's, so each route finds its own name. Warmth is the world's, not the owner's.
    await testCode(user, 'owner.stats.Grit.value = stats.Damp.value;\nreturn 1;');
    await waitFor(() => expect(row()).toHaveTextContent('Result: 1'));
    expect(row()).not.toHaveTextContent('in this code');

    await testCode(user, 'owner.stats.Warmth.value = 1;\nreturn stats.Grit.value;');
    await waitFor(() => expect(row()).toHaveTextContent('2 errors in this code'));
  });

  it('leaves a clean result clean, with nothing to qualify it', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null });
    renderCodePanel(stats[0]);

    await testCode(user, 'return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5'));
    expect(row()).not.toHaveTextContent('in this code');
  });

  it('lists every bound the run wrote beside the value', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null, bounds: { regen: 2, max: 60 } });
    renderCodePanel(stats[0]);

    await testCode(user, 'self.max = 60; self.regen = 2; return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5 · Max: 60 · Regen: 2'));
  });

  it('lists the bounds of a run that wrote no value', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: null, bounds: { min: 3 } });
    renderCodePanel(stats[0]);

    await testCode(user, 'self.min = 3;');

    await waitFor(() => expect(row()).toHaveTextContent('Min: 3'));
    expect(row()).not.toHaveTextContent('Result:');
  });

  it('lists every placeholder the run wrote or unpinned beside the value', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({
      value: 5, error: null, bounds: { max: 60 },
      placeholders: [
        { id: 'ph-mood', path: ['Mood'], value: 'Furious' },
        { id: 'ph-hair', path: ['Hair'], unpin: true },
      ],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'self.max = 60; placeholders.Mood.value = "Furious"; placeholders.Hair.unpin(); return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5 · Max: 60 · Mood = Furious · Hair unpinned'));
  });

  // A write through a path names the placeholder the way the editor does, not by its bare name: two
  // placeholders can share one, so `Hair` alone would not say which one the run pinned.
  it('names a placeholder the run reached by a path with the whole path', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({
      value: null, error: null, placeholders: [{ id: 'ph-shade', path: ['Molly', 'Hair', 'Shade'], value: 'ash' }],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'placeholders.Molly.Hair.Shade.pin("ash");');

    await waitFor(() => expect(row()).toHaveTextContent('Molly › Hair › Shade = ash'));
  });

  // An Object pins to a list. The report is one line per placeholder, so it prints the list as its text.
  it('prints a list pin as the joined text one line holds', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({
      value: null, error: null,
      placeholders: [{ id: 'ph-hair', path: ['Hair'], value: ['silver', 'cropped short'] }],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'placeholders.Hair.pin(["silver", "cropped short"]);');

    await waitFor(() => expect(row()).toHaveTextContent('Hair = silver, cropped short'));
  });

  it('names the placeholders whose writes were dropped', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: null, unknownPlaceholders: ['Nope', 'Molly › Gone'] });
    renderCodePanel(stats[0]);

    await testCode(user, 'placeholders[["No", "pe"].join("")] = "x";');

    await waitFor(() => expect(row())
      .toHaveTextContent('Unknown placeholder paths. Writes ignored: Nope, Molly › Gone.'));
    expect(row()).not.toHaveTextContent('Result:');
  });

  it('runs over the world’s traits with none acquired, and lists each switch without making it', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null, traits: [{ name: 'Brave', enabled: true }] });
    renderCodePanel(stats[0]);

    await testCode(user, 'traits.Brave.enabled = true; return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5 · Brave switched on'));
    const closed = { enabled: false, acquired: false, mode: 'optional', available: true, group: '', playerToggle: false };
    expect(executeStatCode.mock.calls[0][3].traits).toEqual([
      { id: 't1', name: 'Brave', ...closed },
      { id: 't2', name: 'Night Owl', ...closed },
      { id: 't3', name: 'Beast Fury', ...closed },
    ]);
    // The world keeps its authored names, chip token and all: only the sandbox entries read the code name.
    expect(traits).toEqual([
      { id: 't1', name: 'Brave', statChanges: [] },
      { id: 't2', name: 'Night Owl', statChanges: [] },
      { id: 't3', name: FURY, statChanges: [] },
    ]);
  });

  it('runs with no persona playing, and lists a persona switch without making it', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: null, entities: [{ entity: '', traits: [{ name: 'Scarred', enabled: false }] }] });
    renderCodePanel(stats[0]);

    await testCode(user, 'persona.traits.Scarred.enabled = false;');

    await waitFor(() => expect(row()).toHaveTextContent('persona.traits.Scarred switched off'));
    // No persona plays, so `persona` is turn one's empty entry under None (Q3).
    expect(executeStatCode.mock.calls[0][3].persona).toEqual(NO_PERSONA);
  });

  it('names the persona trait writes that did nothing', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({
      value: null, error: null, entities: [{ entity: '', unknownTraits: ['Scarred'], acquiredWrites: ['Marked'] }],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'persona.traits.Scarred.enabled = true; persona.traits.Marked.acquired = true;');

    await waitFor(() => expect(row()).toHaveTextContent('Unknown trait names. Writes ignored: persona.traits.Scarred.'));
    expect(row()).toHaveTextContent('acquired is read-only. Writes ignored: persona.traits.Marked.');
    // Mira can be played, so Formaquestion's code test calls Scarred pending; the editor still runs the empty persona.
    // Turn one's empty entry under None (Q3).
    expect(executeStatCode.mock.calls[0][3].persona).toEqual(NO_PERSONA);
  });

  it('runs with every authored entity listed, nothing chosen and each stat as authored, and lists an entity switch without making it', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: null, entities: [{ entity: 'Ash', traits: [{ name: 'Loyal', enabled: true }] }] });
    renderCodePanel(stats[0]);

    await testCode(user, 'entities.Ash.traits.Loyal.enabled = true;');

    await waitFor(() => expect(row()).toHaveTextContent('entities.Ash.traits.Loyal switched on'));
    // Turn one's cast entries, built by the opening fold as play builds them (Q3).
    const unheld = { enabled: false, acquired: false, available: true, group: '', mode: 'optional', playerToggle: false };
    // No authored text and no location, so each entity reads blank text and stands nowhere.
    const unplaced = { description: '', summary: '', aliases: [], locationIds: [] };
    expect(executeStatCode.mock.calls[0][3].entities).toEqual([
      { id: 'e1', name: 'Mira', type: '', pronouns: '', inScene: false, ...unplaced, traits: [{ id: 't4', name: 'Scarred', ...unheld }] },
      {
        id: 'e2', name: 'Ash', type: '', pronouns: '', inScene: false, ...unplaced, traits: [{ id: 't5', name: 'Loyal', ...unheld }],
        stats: { stats: [{ ...ashStock, starting: 4, ...BASES }], enabled: { a1: false } },
      },
    ]);
  });

  it('names the entity writes that did nothing', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({
      value: null, error: null, unknownEntities: ['Nobody'], entities: [{ entity: 'Ash', unknownTraits: ['Brave'] }],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'entities.Nobody.traits.X.enabled = true; entities.Ash.traits.Brave.enabled = true;');

    await waitFor(() => expect(row()).toHaveTextContent('Unknown entity names. Writes ignored: Nobody.'));
    expect(row()).toHaveTextContent('Unknown trait names. Writes ignored: entities.Ash.traits.Brave.');
  });

  it('names the trait switches and acquired writes that did nothing', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: null, unknownTraits: ['Nope'], acquiredWrites: ['Brave'] });
    renderCodePanel(stats[0]);

    await testCode(user, 'traits.Nope = true; traits.Brave.acquired = true;');

    await waitFor(() => expect(row()).toHaveTextContent('Unknown trait names. Writes ignored: Nope.'));
    expect(row()).toHaveTextContent('acquired is read-only. Writes ignored: Brave.');
  });

  it('lists each write to another stat with its stat name, field and number', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({
      value: 5, error: null, bounds: { max: 60 }, statWrites: [{ id: 's2', name: 'Damp', value: 9, max: 12 }],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'self.max = 60; stats.Damp.value = 9; stats.Damp.max = 12; return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5 · Max: 60 · stats.Damp.value = 9 · stats.Damp.max = 12'));
    // Shown only: the written stat is still as authored, and no save went to it. Typing saved the code to Warmth.
    expect(stats[1]).toMatchObject({ value: 3, max: 10 });
    expect(updateStat.mock.calls.map(([saved]) => saved.id)).not.toContain('s2');
  });

  it('names the writes to stats that do not exist or are switched off', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({
      value: null, error: null, unknownStatWrites: ['stats.Dmap.value'], disabledStatWrites: ['stats.Dusk.max'],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'stats.Dmap.value = 1; stats.Dusk.max = 2;');

    await waitFor(() => expect(row()).toHaveTextContent('Unknown stat names. Writes ignored: stats.Dmap.value.'));
    expect(row()).toHaveTextContent('Switched-off stats. Writes ignored: stats.Dusk.max.');
  });

  const hub = { id: 'o1', name: 'Hub', type: 'number', value: 1, min: 0, max: 5, regen: 0, description: '', descriptors: [] } as Stat;
  const grit = { id: 'o2', name: 'Grit', type: 'number', value: 4, min: 0, max: 8, regen: 0, description: '', descriptors: [] } as Stat;

  // An entity stat's `stats` is the world's list and its `owner.stats` its own, which is what the run is handed.
  it('runs an entity stat’s box over the world’s stats and its entity as owner, and lists its writes to its own stats', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: null, ownerStatWrites: [{ ownerId: 'e2', writes: [{ id: 'o2', name: 'Grit', value: 5 }] }] });
    render(<StatManager stat={withBoxes(hub)} tab="code" onTabChange={() => {}} store={ashHolding([hub, grit])} />);

    await testCode(user, 'owner.stats.Grit.value += 1;');

    await waitFor(() => expect(row()).toHaveTextContent('owner.stats.Grit.value = 5'));
    const [, runStats, , options] = executeStatCode.mock.calls[0];
    // Seeded by the opening fold as play seeds it (Q3).
    expect(runStats).toEqual(SEEDED);
    expect(options.owner).toMatchObject({ id: 'e2', name: 'Ash', stats: { stats: [hub, grit] } });
    expect(grit).toMatchObject({ value: 4, max: 8 });
    expect(updateStat.mock.calls.map(([saved]) => saved.id)).not.toContain('o2');
  });

  it('runs a library entity stat’s box with its entity as owner and no card lookup', async () => {
    noWorld.current = true;
    try {
      const user = userEvent.setup();
      executeStatCode.mockResolvedValue({ value: null, error: null, ownerStatWrites: [{ ownerId: 'e2', writes: [{ id: 'o2', name: 'Grit', value: 5 }] }] });
      render(<StatManager stat={withBoxes(hub)} tab="code" onTabChange={() => {}} store={ashHolding([hub, grit])} />);

      await testCode(user, 'owner.stats.Grit.value += 1;');

      await waitFor(() => expect(row()).toHaveTextContent('owner.stats.Grit.value = 5'));
      expect(propsOf('After the AI').lookup).toBeUndefined();
      const [, , , options] = executeStatCode.mock.calls[0];
      expect(options.owner).toMatchObject({ id: 'e2', stats: { stats: [hub, grit] } });
    } finally {
      noWorld.current = false;
    }
  });

  it('runs a Blueprint stat’s box over the world’s stats and an owner that holds its group’s stats only', async () => {
    const user = userEvent.setup();
    const blueprints = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
    const social = { id: 'bp-social', name: 'Social', parentId: 'bp' };
    const fear = { ...hub, id: 'f', name: 'Fear', groupId: 'bp-social' } as Stat;
    const calm = { ...grit, id: 'c', name: 'Calm', groupId: 'bp-social' } as Stat;
    worldExtra.current = { stats: [...stats, fear, calm], statGroups: [blueprints, social] };
    executeStatCode.mockResolvedValue({ value: null, error: null, ownerStatWrites: [{ ownerId: '', writes: [{ id: 'c', name: 'Calm', value: 5 }] }] });
    renderCodePanel(fear);

    await testCode(user, 'owner.stats.Calm.value += 1;');

    await waitFor(() => expect(row()).toHaveTextContent('owner.stats.Calm.value = 5'));
    const [, runStats, , options] = executeStatCode.mock.calls[0];
    // Seeded by the opening fold as play seeds it (Q3).
    expect(runStats).toEqual(SEEDED);
    expect(options.owner).toMatchObject({ name: '', stats: { stats: [fear, calm] } });
    expect(options.owner.id).toBeUndefined();
  });

  it('runs a world stat’s box with no owner', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 3, error: null });
    renderCodePanel(stats[0]);

    await testCode(user, 'return 3;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 3'));
    expect(executeStatCode.mock.calls[0][3].owner).toBeUndefined();
  });

  it('names every read-only write by its path', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({
      value: null, error: null, readOnlyWrites: ['clock.hour', 'stats.Health.name', 'entities.Ash.traits.Brave.mode'],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'clock.hour = 3; stats.Health.name = "x"; entities.Ash.traits.Brave.mode = "x";');

    await waitFor(() => expect(row())
      .toHaveTextContent('Read-only fields. Writes ignored: clock.hour, stats.Health.name, entities.Ash.traits.Brave.mode.'));
  });

  it('still counts the problems when the run itself threw', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: "Error: 'nope' is not defined" });
    renderCodePanel(stats[0]);

    await testCode(user, 'const x = nope; return alsoNope;');

    await waitFor(() => expect(row()).toHaveTextContent('nope'));
    await waitFor(() => expect(row()).toHaveTextContent('2 errors in this code'));
  });

  it('drops the whole report once the code it described has been edited', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null });
    renderCodePanel(stats[0]);

    await testCode(user, 'if (false) { return nope; } return 5;');
    await waitFor(() => expect(row()).toHaveTextContent('1 error in this code'));

    await user.type(fieldOf('After the AI'), ' ');
    expect(row()).not.toHaveTextContent('Result:');
    expect(row()).not.toHaveTextContent('in this code');
  });
});

describe('a box tests itself', () => {
  beforeEach(() => {
    worldExtra.current = {};
    executeStatCode.mockReset();
    updateStat.mockReset();
    userTemplates.length = 0;
  });

  it('runs the box whose button was pressed, on that box’s own code', async () => {
    const user = userEvent.setup();
    // Inside Warmth's 0–10, so each Result shows the number its box returned.
    executeStatCode.mockResolvedValue({ value: 4, error: null });
    renderCodePanel({ ...stats[0], scripts: boxScripts({ before: 'return 4;', after: 'return 6;' }) });

    await user.click(screen.getByRole('button', { name: testButton('Before the AI') }));

    await waitFor(() => expect(row('Before the AI')).toHaveTextContent('Result: 4'));
    expect(executeStatCode.mock.calls[0][0]).toBe('return 4;');
    // The other box stays silent: its code was never run.
    expect(row('After the AI')).not.toHaveTextContent('Result:');
  });

  // `previous` reads as the stat itself and every `delta` reads zero when the run is handed no turn — which
  // is exactly what the before box reads in play, so the editor's run says the same thing the turn will.
  it('runs the before box with no turn behind it, so every delta reads zero', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 3, error: null });
    renderCodePanel({ ...stats[0], scripts: boxScripts({ before: 'return self.delta.ai.value + 3;' }) });

    await user.click(screen.getByRole('button', { name: testButton('Before the AI') }));

    await waitFor(() => expect(row('Before the AI')).toHaveTextContent('Result: 3'));
    expect(executeStatCode.mock.calls[0][3]).not.toHaveProperty('readings');
  });

  // The before box runs at turn start, so it has consumed no hours and, with none elapsed, stands on the
  // opening turn — the one its own templates are written for.
  it('runs each box on the clock that box gets', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 1, error: null });
    renderCodePanel({ ...stats[0], scripts: boxScripts({ before: 'return 1;', after: 'return 1;' }) });

    await user.click(screen.getByRole('button', { name: testButton('Before the AI') }));
    await waitFor(() => expect(executeStatCode).toHaveBeenCalled());
    expect(executeStatCode.mock.calls[0][3].clock).toEqual({ deltaHours: 0, elapsedHours: 0 });

    await user.click(screen.getByRole('button', { name: testButton('After the AI') }));
    await waitFor(() => expect(executeStatCode).toHaveBeenCalledTimes(2));
    expect(executeStatCode.mock.calls[1][3].clock).toEqual({ deltaHours: 1, elapsedHours: 1 });
  });

  it('clears only the edited box’s report', async () => {
    const user = userEvent.setup();
    // Inside Warmth's 0–10, so each Result shows the number its box returned.
    executeStatCode.mockResolvedValue({ value: 4, error: null });
    renderCodePanel({ ...stats[0], scripts: boxScripts({ before: 'return 4;' }) });

    await user.click(screen.getByRole('button', { name: testButton('Before the AI') }));
    await waitFor(() => expect(row('Before the AI')).toHaveTextContent('Result: 4'));

    executeStatCode.mockResolvedValue({ value: 6, error: null });
    await testCode(user, 'return 6;');
    await waitFor(() => expect(row('After the AI')).toHaveTextContent('Result: 6'));
    // Running and editing the other box left this one's report where it was.
    expect(row('Before the AI')).toHaveTextContent('Result: 4');

    await user.type(fieldOf('Before the AI'), ' ');
    expect(row('Before the AI')).not.toHaveTextContent('Result:');
    expect(row('After the AI')).toHaveTextContent('Result: 6');
  });

  // The whole point of a per-box menu: what it inserts lands in that box and runs from that box's own
  // button. The before menu's Opening Turn Value returns nothing on a later turn, so a Result here also
  // says the run used the opening-turn clock the before box gets.
  it('inserts a before-menu template into the before box and runs it there', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 50, error: null });
    renderCodePanel(stats[0]);

    await user.click(screen.getByRole('button', { name: templatesButton('Before the AI') }));
    await user.click(await screen.findByRole('button', { name: 'Opening Turn Value' }));
    await user.click(screen.getByRole('button', { name: 'Insert Code' }));

    const inserted = ['if (clock.elapsedHours > 0) return;', 'return 50;'].join('\n');
    await waitFor(() => expect(fieldOf('Before the AI')).toHaveValue(inserted));
    // Into the before box alone: the after box is untouched.
    expect(fieldOf('After the AI')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: testButton('Before the AI') }));
    // The template's 50 lands inside Warmth's 0–10.
    await waitFor(() => expect(row('Before the AI')).toHaveTextContent('Result: 10'));
    expect(executeStatCode.mock.calls[0][0]).toBe(inserted);
  });

  // A template saved before the routes moved still holds the old ones; what it inserts runs today.
  it('inserts a saved template on the current routes', async () => {
    const user = userEvent.setup();
    userTemplates.push({
      id: 'saved-drain', name: 'Saved Drain', description: '', kind: 'script', timings: ['after'],
      code: 'return self.value - deltaHours + (currentStatId ? 0 : 1);',
    });
    renderCodePanel(stats[0]);

    await user.click(screen.getByRole('button', { name: templatesButton('After the AI') }));
    await user.click(await screen.findByRole('button', { name: 'Saved Drain' }));
    await user.click(screen.getByRole('button', { name: 'Insert Code' }));

    await waitFor(() => expect(fieldOf('After the AI'))
      .toHaveValue('return self.value - clock.deltaHours + (self.id ? 0 : 1);'));
  });

  it('offers an At Game Start box the templates of its own timing', async () => {
    const user = userEvent.setup();
    renderCodePanel({ ...stats[0], scripts: [{ id: 'start', timing: 'start', code: '' }] });

    await user.click(screen.getByRole('button', { name: /^Templates .* · At Game Start$/ }));
    expect(await screen.findByRole('button', { name: 'Weighted Blend' })).toBeInTheDocument();
    // Its clock has no hours behind it, so a drift template is not offered.
    expect(screen.queryByRole('button', { name: 'Hourly Change' })).toBeNull();
  });

  it('lists an entity stat’s own traits under Owner in a trait slot, and inserts them through `owner.traits`', async () => {
    const user = userEvent.setup();
    const hub = { id: 'o1', name: 'Hub', type: 'number', value: 1, min: 0, max: 5, regen: 0, description: '', descriptors: [] } as Stat;
    render(<StatManager stat={withBoxes(hub)} tab="code" onTabChange={() => {}} store={ashHolding([hub])} />);

    await user.click(screen.getByRole('button', { name: templatesButton('After the AI') }));
    await user.click(await screen.findByRole('button', { name: 'Trait by Threshold' }));
    await user.click(screen.getByRole('combobox', { name: 'Trait' }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['LoyalOwner', 'BraveWorld', 'Night OwlWorld', 'Beast FuryWorld']);
    await user.click(screen.getByRole('option', { name: /^Loyal/ }));
    await user.click(screen.getByRole('button', { name: 'Insert Code' }));

    await waitFor(() => expect(fieldOf('After the AI')).toHaveValue('owner.traits["Loyal"].enabled = self.value >= 50;'));
  });

  it('lists the world’s traits alone in a global stat’s trait slot', async () => {
    const user = userEvent.setup();
    renderCodePanel(stats[0]);

    await user.click(screen.getByRole('button', { name: templatesButton('After the AI') }));
    await user.click(await screen.findByRole('button', { name: 'Trait by Threshold' }));
    await user.click(screen.getByRole('combobox', { name: 'Trait' }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['BraveWorld', 'Night OwlWorld', 'Beast FuryWorld']);
  });

  it('offers no run on an empty box', async () => {
    renderCodePanel({ ...stats[0], scripts: boxScripts({ before: '   ', after: 'return 1;' }) });

    expect(screen.getByRole('button', { name: testButton('Before the AI') })).toBeDisabled();
    expect(screen.getByRole('button', { name: testButton('After the AI') })).toBeEnabled();
  });
});
