import { useMemo, useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Entity, Placeholder, Script, Stat, StatGroup, Tool, Trait, TraitGroup } from '@/types';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { statCodeName } from '@/lib/statCodeNames';
import type { RenamedStat } from '@/lib/statCodeRename';
import { statLinkState } from '@/lib/statLinks';
import { useCodeRenameOffer, useRenameField } from '@/lib/useCodeRename';
import { CodeRenameProvider } from './CodeRenameOffer';
import { boxScripts, codeAt, overriddenCodeAt } from '@/test/scriptFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';

const stat = (id: string, name: string, code: string): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, scripts: boxScripts({ after: code }) } as unknown as Stat);

const store: {
  stats: Stat[]; statGroups: StatGroup[]; traits: Trait[]; traitGroups: TraitGroup[]; entities: Entity[]; placeholders: Placeholder[];
  worldScripts: Script[]; worldTools: Tool[]; rerender: () => void;
} = {
  stats: [], statGroups: [], traits: [], traitGroups: [], entities: [], placeholders: [], worldScripts: [], worldTools: [], rerender: () => {},
};

vi.mock('@/contexts/GameDataContext', () => ({
  useGameDataOptional: () => ({
    stats: store.stats,
    statGroups: store.statGroups,
    traits: store.traits,
    traitGroups: store.traitGroups,
    entities: store.entities,
    worldScripts: store.worldScripts,
    worldTools: store.worldTools,
    setWorldTools: (next: Tool[]) => {
      store.worldTools = next;
      store.rerender();
    },
    setWorldScripts: (next: Script[]) => {
      store.worldScripts = next;
      store.rerender();
    },
    updateStat: (next: Stat) => {
      store.stats = store.stats.map((entry) => (entry.id === next.id ? next : entry));
      store.rerender();
    },
    updateTrait: (next: Trait) => {
      store.traits = store.traits.map((entry) => (entry.id === next.id ? next : entry));
      store.rerender();
    },
    editEntity: (id: string, edit: (entity: Entity) => Entity) => {
      store.entities = store.entities.map((entity) => (entity.id === id ? edit(entity) : entity));
      store.rerender();
    },
  }),
}));

/** A name field reduced to what the offer reads: a value, and the commit handlers the real fields wire. */
const NameField = ({ root, initial, otherNames, chips, renamed }: {
  root: 'stats' | 'placeholders' | 'traits' | 'locations';
  initial: string;
  otherNames: string[];
  /** Read the value as a code name, the way the stat and trait panels do. */
  chips?: boolean;
  /** The stat the field names, as the stat panel passes it. */
  renamed?: RenamedStat;
}) => {
  const [value, setValue] = useState(initial);
  // The hook takes the whole sibling list and the id being edited; the cases name the other entries, so
  // this one stands in as the entry those belong beside.
  const siblings = useMemo(
    () => [{ id: 'self', name: initial }, ...otherNames.map((name, i) => ({ id: `other${i}`, name }))],
    [initial, otherNames],
  );
  const rename = useRenameField({
    root,
    value,
    siblings,
    ownId: 'self',
    codeNameOf: chips ? (name) => statCodeName(name, store.placeholders) : undefined,
    stat: renamed,
  });
  return (
    <input
      aria-label="Name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={rename.onFocus}
      onBlur={rename.onBlur}
      onKeyDown={(e) => { if (e.key === 'Enter') rename.onSubmit(); }}
    />
  );
};

const Harness = (props: Parameters<typeof NameField>[0]) => {
  const [, setTick] = useState(0);
  store.rerender = () => setTick((n) => n + 1);
  return (
    <CodeRenameProvider>
      <NameField {...props} />
      <button type="button">elsewhere</button>
    </CodeRenameProvider>
  );
};

const codeOf = (id: string) => codeAt(store.stats.find((entry) => entry.id === id));
const beforeCodeOf = (id: string) => codeAt(store.stats.find((entry) => entry.id === id), 'before');

/** Put a new name in the field and commit it by moving focus off, as blurring the real field does. Pasted
 *  rather than typed, so a chip token's braces reach the field instead of being read as typing syntax. */
async function renameTo(next: string) {
  const user = userEvent.setup();
  const field = screen.getByLabelText('Name');
  await user.click(field);
  await user.clear(field);
  await user.paste(next);
  await user.click(screen.getByRole('button', { name: 'elsewhere' }));
  return user;
}

beforeEach(() => {
  store.placeholders = [];
  store.statGroups = [];
  store.traits = [];
  store.traitGroups = [];
  store.entities = [];
  store.worldScripts = [];
  store.worldTools = [];
  store.stats = [
    stat('a', 'Health', 'return stats.Health.value * 2;'),
    stat('b', 'Stamina', `return stats['Health'].max - 1;`),
    stat('c', 'Grit', 'return self.value;'),
  ];
});

describe('the rename offer', () => {
  it('keeps a link override current when the rename rewrites its Blueprint too, and a stale one stale', async () => {
    const howl = { ...stat('howl', 'Howl', 'return stats.Ruin.value;'), groupId: 'bp' };
    const howlLink = (entityId: string, blueprint: string) => ({
      id: `l-${entityId}`, originalId: 'howl', kind: 'stat' as const, originalName: 'Howl', groupId: null,
      overrides: { howl: { scripts: { value: boxScripts({ after: 'return stats.Ruin.value + 1;' }), blueprint: boxScripts({ after: blueprint }) } } },
    });
    store.statGroups = [{ id: 'bp', name: 'Blueprints', system: 'blueprints' } as StatGroup];
    store.stats = [stat('ruin', 'Ruin', ''), howl];
    store.entities = [
      { id: 'bram', name: 'Bram', statLinks: [howlLink('bram', 'return stats.Ruin.value;')] },
      { id: 'ash', name: 'Ash', statLinks: [howlLink('ash', 'return 0;')] },
    ];
    render(<Harness root="stats" initial="Ruin" otherNames={[]} renamed={{ id: 'ruin' }} />);
    const user = await renameTo('Wreck');
    await user.click(screen.getByRole('button', { name: 'Update Code' }));

    const blueprint = store.stats.find((entry) => entry.id === 'howl')!;
    expect(codeAt(blueprint)).toBe('return stats.Wreck.value;');
    const [bram, ash] = store.entities.map((entity) => entity.statLinks![0]);
    expect(overriddenCodeAt(bram.overrides?.howl?.scripts)).toBe('return stats.Wreck.value + 1;');
    expect(statLinkState(blueprint, bram).stale).toEqual([]);
    expect(overriddenCodeAt(ash.overrides?.howl?.scripts)).toBe('return stats.Wreck.value + 1;');
    expect(statLinkState(blueprint, ash).stale).toEqual(['scripts']);
  });

  it('rewrites an entity’s own stat in its own box, its link’s override, and a world box', async () => {
    const howl = { ...stat('howl', 'Howl', 'return owner.stats.Rage.value;'), groupId: 'bp' };
    store.statGroups = [{ id: 'bp', name: 'Blueprints', system: 'blueprints' } as StatGroup];
    store.stats = [stat('reader', 'Reader', 'return entities.Bram.stats.Rage.value + stats.Rage.value;'), stat('rage-w', 'Rage', ''), howl];
    store.entities = [{
      id: 'bram', name: 'Bram', stats: [stat('rage', 'Rage', 'return owner.stats.Rage.value;')],
      statLinks: [{
        id: 'l-howl', originalId: 'howl', kind: 'stat', originalName: 'Howl', groupId: null,
        overrides: { howl: { scripts: { value: boxScripts({ after: 'return owner.stats.Rage.value + 1;' }), blueprint: boxScripts({ after: 'return owner.stats.Rage.value;' }) } } },
      }],
    }];
    render(<Harness root="stats" initial="Rage" otherNames={[]} renamed={{ id: 'rage', entityId: 'bram' }} />);
    const user = await renameTo('Spite');

    expect(screen.getByText(/The code of 3 stats names the stat “Rage” 3 times\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    const [bram] = store.entities;
    expect(codeAt(bram.stats?.[0])).toBe('return owner.stats.Spite.value;');
    expect(overriddenCodeAt(bram.statLinks?.[0].overrides?.howl?.scripts)).toBe('return owner.stats.Spite.value + 1;');
    expect(codeOf('reader')).toBe('return entities.Bram.stats.Spite.value + stats.Rage.value;');
    expect(codeOf('howl')).toBe('return owner.stats.Rage.value;');
  });

  it('rewrites a world trait’s script, an entity’s own trait’s and a trait link’s override, counting traits apart', async () => {
    const after = (code: string) => [{ id: 'x', timing: 'after' as const, code }];
    const howl: Trait = { id: 'howl', name: 'Howl', statChanges: [], groupId: 'bp', scripts: after('stats.Health.value = 1;') };
    store.traitGroups = [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }];
    store.traits = [{ id: 'brave', name: 'Brave', statChanges: [], scripts: after('stats.Health.value += 1;') }, howl];
    store.entities = [{
      id: 'bram', name: 'Bram', traits: [{ id: 'grim', name: 'Grim', statChanges: [], scripts: after('stats.Health.max = 5;') }],
      traitLinks: [{
        id: 'l-howl', originalId: 'howl', kind: 'trait', originalName: 'Howl', groupId: null,
        overrides: { howl: { scripts: { value: after('stats.Health.value = 2;'), blueprint: howl.scripts! } } },
      }],
    }];
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} renamed={{ id: 'a' }} />);
    const user = await renameTo('Vigor');

    expect(screen.getByText(/The code of 2 stats and 4 traits names the stat “Health” 6 times\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeAt(store.traits[0])).toBe('stats.Vigor.value += 1;');
    expect(codeAt(store.traits[1])).toBe('stats.Vigor.value = 1;');
    const [bram] = store.entities;
    expect(codeAt(bram.traits?.[0])).toBe('stats.Vigor.max = 5;');
    const link = bram.traitLinks![0].overrides?.howl?.scripts;
    expect(overriddenCodeAt(link)).toBe('stats.Vigor.value = 2;');
    // The rename rewrote the Blueprint too, so the override's snapshot moved with it and stays current.
    expect(link?.blueprint).toEqual(after('stats.Vigor.value = 1;'));
  });

  it('rewrites a world script that alone names the renamed stat', async () => {
    store.stats = [stat('gale', 'Gale', '')];
    store.worldScripts = [{ id: 'weather', timing: 'after', code: 'stats.Gale.value = 3;' }, { id: 'calm', timing: 'before', code: 'return 0;' }];
    render(<Harness root="stats" initial="Gale" otherNames={[]} renamed={{ id: 'gale' }} />);
    const user = await renameTo('Gust');

    expect(screen.getByText(/The code of 1 world script names the stat “Gale” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(store.worldScripts).toEqual([
      { id: 'weather', timing: 'after', code: 'stats.Gust.value = 3;' }, { id: 'calm', timing: 'before', code: 'return 0;' },
    ]);
  });

  it('rewrites a World Tool that alone names the renamed stat, keeping its other fields', async () => {
    store.stats = [stat('gale', 'Gale', '')];
    store.worldTools = [
      scriptWorldTool('storm-id', 'storm', 'stats.Gale.value = 3;', 'output'),
      scriptWorldTool('calm-id', 'calm', 'return 0;', 'call'),
    ];
    render(<Harness root="stats" initial="Gale" otherNames={[]} renamed={{ id: 'gale' }} />);
    const user = await renameTo('Gust');

    expect(screen.getByText(/The code of 1 World Tool names the stat “Gale” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(store.worldTools).toEqual([
      scriptWorldTool('storm-id', 'storm', 'stats.Gust.value = 3;', 'output'),
      scriptWorldTool('calm-id', 'calm', 'return 0;', 'call'),
    ]);
  });

  it('names stats, traits, world scripts and World Tools together when all of them name it', async () => {
    store.stats = [stat('gale', 'Gale', 'return stats.Gale.value;')];
    store.worldScripts = [{ id: 'weather', timing: 'after', code: 'stats.Gale.value = 3;' }];
    store.worldTools = [scriptWorldTool('storm-id', 'storm', 'stats.Gale.value = 4;'), scriptWorldTool('gust-id', 'gust', 'stats.Gale.max = 4;')];
    render(<Harness root="stats" initial="Gale" otherNames={[]} renamed={{ id: 'gale' }} />);
    await renameTo('Gust');

    expect(screen.getByText(/The code of 1 stat and 1 world script and 2 World Tools names the stat “Gale” 4 times\./)).toBeInTheDocument();
  });

  it('carries a location rename into the literal of location.move in a world script, a World Tool and a stat', async () => {
    store.stats = [stat('gale', 'Gale', 'location.move("Inn");')];
    store.worldScripts = [{ id: 'w1', timing: 'after', code: 'location.move("Inn"); location.move(where);' }];
    store.worldTools = [scriptWorldTool('storm-id', 'storm', "location.move('Inn');")];
    render(<Harness root="locations" initial="Inn" otherNames={[]} />);
    const user = await renameTo('Harbor Steps');

    expect(screen.getByText(/The code of 1 stat and 1 world script and 1 World Tool names the location “Inn” 3 times\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(store.worldScripts[0].code).toBe('location.move("Harbor Steps"); location.move(where);');
    expect(store.worldTools).toEqual([scriptWorldTool('storm-id', 'storm', "location.move('Harbor Steps');")]);
    expect(codeOf('gale')).toBe('location.move("Harbor Steps");');
  });

  it('carries a trait rename into world scripts', async () => {
    store.stats = [];
    store.traits = [{ id: 'brave', name: 'Brave', statChanges: [] }];
    store.worldScripts = [{ id: 'w1', timing: 'after', code: 'const b = traits.Brave;' }, { id: 'w2', timing: 'start', code: 'traits.Brave.enabled = true;' }];
    render(<Harness root="traits" initial="Brave" otherNames={[]} />);
    const user = await renameTo('Bold');

    expect(screen.getByText(/The code of 2 world scripts names the trait “Brave” 2 times\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(store.worldScripts.map((script) => script.code)).toEqual(['const b = traits.Bold;', 'traits.Bold.enabled = true;']);
  });

  it('asks with the count, and rewrites every script on Yes', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    const user = await renameTo('Vigor');

    expect(screen.getByText(/The code of 2 stats names the stat “Health” 2 times\./)).toBeInTheDocument();
    expect(screen.getByText(/Update them to “Vigor”\?/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe('return stats.Vigor.value * 2;');
    expect(codeOf('b')).toBe(`return stats['Vigor'].max - 1;`);
  });

  it('counts both boxes, rewrites both on Yes, and leaves a blank box blank', async () => {
    store.stats = [
      { ...stat('a', 'Health', ''), scripts: boxScripts({ before: `stats['Health'].min = 1;`, after: 'return stats.Health.value * 2;' }) },
      stat('b', 'Stamina', 'return stats.Health.max - 1;'),
    ];
    render(<Harness root="stats" initial="Health" otherNames={['Stamina']} />);
    const user = await renameTo('Vigor');

    expect(screen.getByText(/The code of 2 stats names the stat “Health” 3 times\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(beforeCodeOf('a')).toBe(`stats['Vigor'].min = 1;`);
    expect(codeOf('a')).toBe('return stats.Vigor.value * 2;');
    // Stamina's before box was never filled, so the rewrite must not have written one onto it.
    expect(beforeCodeOf('b')).toBeUndefined();
    expect(codeOf('b')).toBe('return stats.Vigor.max - 1;');
  });

  it('rewrites nothing on No, in either box', async () => {
    store.stats = [
      { ...stat('a', 'Health', ''), scripts: boxScripts({ before: `stats['Health'].min = 1;`, after: 'return stats.Health.value * 2;' }) },
    ];
    render(<Harness root="stats" initial="Health" otherNames={['Stamina']} />);
    const user = await renameTo('Vigor');

    await user.click(screen.getByRole('button', { name: 'Leave Code' }));
    expect(beforeCodeOf('a')).toBe(`stats['Health'].min = 1;`);
    expect(codeOf('a')).toBe('return stats.Health.value * 2;');
  });

  it('rewrites nothing on No', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    const user = await renameTo('Vigor');

    await user.click(screen.getByRole('button', { name: 'Leave Code' }));
    expect(codeOf('a')).toBe('return stats.Health.value * 2;');
    expect(codeOf('b')).toBe(`return stats['Health'].max - 1;`);
  });

  it('asks once, for the final name, however many names the author types through', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    const user = userEvent.setup();
    const field = screen.getByLabelText('Name');
    await user.click(field);
    await user.clear(field);
    await user.type(field, 'Vig');
    await user.type(field, 'or');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
    expect(screen.getByText(/Update them to “Vigor”\?/)).toBeInTheDocument();
  });

  it('asks nothing when the name comes back unchanged', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks nothing when the new name is one another stat already carries', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    await renameTo('Stamina');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks nothing when no code names the old name', async () => {
    render(<Harness root="stats" initial="Grit" otherNames={['Health', 'Stamina']} />);
    await renameTo('Resolve');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('carries a trait rename over traits references', async () => {
    store.stats = [stat('a', 'Health', 'return traits.Brave.enabled ? 2 : 1;')];
    render(<Harness root="traits" initial="Brave" otherNames={['Shy']} />);
    const user = await renameTo('Bold');

    expect(screen.getByText(/names the trait “Brave” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe('return traits.Bold.enabled ? 2 : 1;');
  });

  it('carries a placeholder rename over placeholders references', async () => {
    store.stats = [stat('a', 'Health', `placeholders.Mood.pin('calm'); return self.value;`)];
    render(<Harness root="placeholders" initial="Mood" otherNames={['Weather']} />);
    const user = await renameTo('Temper');

    expect(screen.getByText(/names the placeholder “Mood” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe(`placeholders.Temper.pin('calm'); return self.value;`);
  });

  it('carries a placeholder rename into world scripts beside a stat’s', async () => {
    store.stats = [stat('a', 'Health', `placeholders.Mood.pin('calm'); return self.value;`)];
    store.worldScripts = [{ id: 'w1', timing: 'start', code: `placeholders.Mood.pin('calm');` }];
    render(<Harness root="placeholders" initial="Mood" otherNames={['Weather']} />);
    const user = await renameTo('Temper');

    expect(screen.getByText(/The code of 1 stat and 1 world script names the placeholder “Mood” 2 times\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe(`placeholders.Temper.pin('calm'); return self.value;`);
    expect(store.worldScripts[0].code).toBe(`placeholders.Temper.pin('calm');`);
  });

  it('compares a chip-bearing stat name the way code reads it', async () => {
    store.placeholders = [{ id: 'p1', name: 'Beast', values: [] } as unknown as Placeholder];
    const token = encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'pl1' });
    store.stats = [stat('a', `${token} Power`, `return stats['Beast Power'].value;`)];
    render(<Harness root="stats" initial={`${token} Power`} otherNames={[]} chips />);
    const user = await renameTo(`${token} Might`);

    expect(screen.getByText(/names the stat “Beast Power” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe(`return stats['Beast Might'].value;`);
  });

  it('compares a chip-bearing trait name the way code reads it', async () => {
    store.placeholders = [{ id: 'p1', name: 'Beast', values: [] } as unknown as Placeholder];
    const token = encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'pl1' });
    store.stats = [stat('a', 'Health', `return traits['Beast Fury'].enabled ? 2 : 1;`)];
    render(<Harness root="traits" initial={`${token} Fury`} otherNames={[]} chips />);
    const user = await renameTo(`${token} Rage`);

    expect(screen.getByText(/names the trait “Beast Fury” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe(`return traits['Beast Rage'].enabled ? 2 : 1;`);
  });

  it('asks the next queued rename after the first is answered either way', async () => {
    // One Replace All renames several things in a single pass and reports each, so two questions queue
    // together and the second has to survive the first being answered.
    const ReplaceAll = () => {
      const [, setTick] = useState(0);
      store.rerender = () => setTick((n) => n + 1);
      const offer = useCodeRenameOffer();
      return (
        <button
          type="button"
          onClick={() => {
            offer({ root: 'stats', oldName: 'Health', newName: 'Vigor', otherNames: ['Grit'] });
            offer({ root: 'traits', oldName: 'Brave', newName: 'Bold', otherNames: ['Shy'] });
          }}
        >
          replace all
        </button>
      );
    };
    store.stats = [stat('a', 'Health', 'return stats.Health.value + (traits.Brave.enabled ? 1 : 0);')];
    render(<CodeRenameProvider><ReplaceAll /></CodeRenameProvider>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'replace all' }));

    expect(screen.getByText(/names the stat “Health” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));

    expect(await screen.findByText(/names the trait “Brave” 1 time\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(codeOf('a')).toBe('return stats.Vigor.value + (traits.Bold.enabled ? 1 : 0);');
  });

  it('commits on Enter without waiting for the field to lose focus', async () => {
    render(<Harness root="stats" initial="Health" otherNames={['Stamina', 'Grit']} />);
    const user = userEvent.setup();
    const field = screen.getByLabelText('Name');
    await user.click(field);
    await user.clear(field);
    await user.paste('Vigor');
    // Dispatched rather than typed: userEvent re-reads which element is focused between the keydown and
    // the activation it synthesizes, so the dialog this Enter opens takes its own Cancel press. A browser
    // settles that target before dispatching the keydown, and pressing Enter in the real editor opens the
    // offer and leaves it open.
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(await screen.findByText(/Update them to “Vigor”\?/)).toBeInTheDocument();
  });
});
