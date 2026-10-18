import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Entity, EntityGroup, Placeholder, PlaceholderGroup, Stat, Trait, TraitGroup } from '@/types';
import { entityTraitNames, worldTraitPlaces } from '@/lib/statCodeTraits';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { worldPlaceholderPlaces } from '@/lib/statCodePlaceholderPlaces';
import { StatCodeTemplateDialog } from './StatCodeTemplateDialog';
import type { ScriptTiming } from '@/types';
import type { CodeTemplate } from '@/lib/statCodeTemplates';

/** What a template asks for is a form the author writes by typing slots into code, and the form has to
 *  agree with the code it generates underneath — that agreement is what these cover. */

const stats = [
  { id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10 },
  { id: 's2', name: 'Damp', type: 'number', value: 3, min: 0, max: 10 },
] as unknown as Stat[];

// The real editor arrives on its own chunk and brings CodeMirror with it; a textarea over the same
// value is enough to type a slot into. Its `preview` is rendered rather than dropped — in the template
// editor that pane IS the form under test, and the real field shows it beside the code.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: {
    value: string; onChange: (next: string) => void; ariaLabel: string; preview?: React.ReactNode;
  }) => (
    <>
      <textarea
        aria-label={props.ariaLabel}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.preview}
    </>
  ),
}));

// Traits tab: Lineage › Storms › Storm Touched, Lineage › Heir, then Cursed at the top level.
const traitGroups: TraitGroup[] = [
  { id: 'lineage', name: 'Lineage', parentId: null, order: 0 },
  { id: 'storms', name: 'Storms', parentId: 'lineage', order: 0 },
];
const traits: Trait[] = [
  { id: 'cursed', name: 'Cursed', statChanges: [], order: 1 },
  { id: 'heir', name: 'Heir', statChanges: [], groupId: 'lineage', order: 1 },
  { id: 'storm', name: 'Storm Touched', statChanges: [], groupId: 'storms', order: 0 },
];
// Entities tab: Crew › Deck › Mira, Crew › Rook, then Ash. Each owns a trait the world's `traits` never holds.
const entityGroups: EntityGroup[] = [
  { id: 'crew', name: 'Crew', parentId: null, order: 0 },
  { id: 'deck', name: 'Deck', parentId: 'crew', order: 0 },
];
const owned = (id: string, name: string, groupId?: string): Trait => ({ id, name, statChanges: [], groupId });
// Mira's own Traits tree: Scars › Wounded, then Calm at the top level.
const entities: Entity[] = [
  {
    id: 'e1', name: 'Mira', groupId: 'deck', order: 0,
    traitGroups: [{ id: 'scars', name: 'Scars', parentId: null, order: 0 }],
    traits: [{ ...owned('calm', 'Calm'), order: 1 }, owned('wounded', 'Wounded', 'scars')],
  },
  { id: 'e2', name: 'Ash', order: 1, traits: [owned('loyal', 'Loyal')] },
  { id: 'e3', name: 'Rook', groupId: 'crew', order: 1, persona: true, traits: [owned('scarred', 'Scarred')] },
];

// Placeholders tab: Looks > Hair Color (holding the child Tint), then Mood at the top level. Mira owns Secret.
const placeholderGroups: PlaceholderGroup[] = [{ id: 'looks', name: 'Looks', parentId: null, order: 0 }];
const placeholders: Placeholder[] = [
  { id: 'mood', name: 'Mood', values: [{ id: 'mood-v', text: 'calm' }] },
  {
    id: 'hair', name: 'Hair Color', groupId: 'looks',
    values: [{ id: 'hair-v', text: encodePlaceholderToken({ id: 'tint', mode: 'world', placementId: 'p1' }) }],
  },
  { id: 'tint', name: 'Tint', ownerId: 'hair', values: [{ id: 'tint-v', text: 'ash' }] },
  { id: 'secret', name: 'Secret', values: [{ id: 'secret-v', text: 'x' }] },
];
const placeholderOwners = new Map([['secret', { kind: 'entity' as const, id: 'e1', name: 'Mira' }]]);

type DialogProps = Extract<React.ComponentProps<typeof StatCodeTemplateDialog>, { kind?: 'script' | 'worldScript' }>;

const open = (timing: ScriptTiming = 'after', cast: Entity[] = entities, extra: Partial<DialogProps> = {}) => render(
  <StatCodeTemplateDialog
    open
    onOpenChange={vi.fn()}
    timing={timing}
    stats={stats}
    currentStatId="s1"
    hasExistingCode={false}
    onInsert={vi.fn()}
    placeholderPlaces={worldPlaceholderPlaces({ list: placeholders, owners: placeholderOwners, groups: placeholderGroups })}
    traitPlaces={worldTraitPlaces({ traits, traitGroups }, [])}
    entities={entityTraitNames({ traits, traitGroups, entities: cast, entityGroups }, [])}
    {...extra}
  />,
);

/** Each listed row's text: its name, then its breadcrumb. */
const rows = async () => (await screen.findAllByRole('option')).map((option) => option.textContent);
// The highlighter splits the code into token spans, so read the whole generated block.
const generated = () => document.querySelector('pre')?.textContent ?? '';

const localTemplate: CodeTemplate = {
  id: 'local-template',
  name: 'Local Demonstration',
  description: 'A controlled template.',
  code: 'return {{amount:number=2}};',
  kind: 'script',
  timings: ['after'],
};

/** Start a new template and replace its code with `code`. */
async function authoring(
  user: ReturnType<typeof userEvent.setup>, code: string, timing: ScriptTiming = 'after', cast?: Entity[], extra?: Partial<DialogProps>,
) {
  open(timing, cast, extra);
  await user.click(await screen.findByRole('button', { name: /New Template/i }));
  const field = await screen.findByLabelText('Template code');
  await user.clear(field);
  await user.paste(code);
  return field;
}

describe('the form a template presents', () => {
  it('shows a slot’s declared default the moment it is typed into the code', async () => {
    const user = userEvent.setup();
    await authoring(user, 'return (me?.value ?? 0) + {{ratePerHour:number=-5}} * deltaHours;');

    // Typed after the editor opened, so nothing seeded it — the default has to come from the slot itself.
    await waitFor(() => expect(screen.getByLabelText('Rate Per Hour')).toHaveValue('-5'));
  });

  it('does not ask for a slot the template already answered', async () => {
    const user = userEvent.setup();
    await authoring(user, 'return {{ratePerHour:number=-5}};');

    await waitFor(() => expect(screen.getByLabelText('Rate Per Hour')).toHaveValue('-5'));
    expect(screen.queryByText('Required')).toBeNull();
  });

  it('still asks for a slot the template left blank', async () => {
    const user = userEvent.setup();
    await authoring(user, 'return stats.find(s => s.name === {{source:stat}})?.value ?? 0;');

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument());
  });

  // Snapping back on every keystroke would refill a backspaced field before the next character landed.
  it('lets a defaulted number be backspaced and retyped', async () => {
    const user = userEvent.setup();
    await authoring(user, 'return {{ratePerHour:number=-5}};');
    const slotField = await screen.findByLabelText('Rate Per Hour');

    await user.clear(slotField);
    expect(slotField).toHaveValue('');
    await user.type(slotField, '2');
    expect(slotField).toHaveValue('2');
  });

  it('returns a field left blank to the default once you leave it', async () => {
    const user = userEvent.setup();
    await authoring(user, 'return {{ratePerHour:number=-5}};');
    const slotField = await screen.findByLabelText('Rate Per Hour');

    await user.clear(slotField);
    await user.tab();
    await waitFor(() => expect(slotField).toHaveValue('-5'));
  });

  // A name slot picks from the world's own list so the generated string always matches something.
  it('offers the world’s placeholders and traits for their slot types, quoted in the code', async () => {
    const user = userEvent.setup();
    await authoring(user, 'placeholders[{{p:placeholder}}].value = "x"; traits[{{t:trait}}].enabled = true;');

    await user.click(await screen.findByRole('combobox', { name: 'P' }));
    await user.click(await screen.findByRole('option', { name: /^Hair Color/ }));
    await user.click(await screen.findByRole('combobox', { name: 'T' }));
    await user.click(await screen.findByRole('option', { name: /^Cursed/ }));

    await waitFor(() => expect(generated()).toContain('placeholders["Hair Color"]'));
    expect(generated()).toContain('traits["Cursed"]');
  });

  it('lists only the placeholders code reaches by name, under their folders', async () => {
    const user = userEvent.setup();
    await authoring(user, 'placeholders[{{p:placeholder}}].value = "x";');

    await user.click(await screen.findByRole('combobox', { name: 'P' }));
    // Tint is held by Hair Color and Secret by Mira, so neither is a top-level key.
    expect(await rows()).toEqual(['Hair ColorLooks', 'Mood']);
  });

  it('lists the other stats in a stat slot, with no breadcrumb', async () => {
    const user = userEvent.setup();
    await authoring(user, 'return stats.find(s => s.name === {{source:stat}})?.value ?? 0;');

    await user.click(await screen.findByRole('combobox', { name: 'Source' }));
    expect(await rows()).toEqual(['Damp']);
    await user.click(screen.getByRole('option', { name: 'Damp' }));
    await waitFor(() => expect(generated()).toContain('s.name === "Damp"'));
    expect(screen.getByRole('combobox', { name: 'Source' })).toHaveTextContent('Damp');
  });

  describe('in an owned or Blueprint stat’s box', () => {
    // Mira's own Rage and Stock sit beside the world's Warmth and Damp; Warmth is the stat being edited.
    const rage = { id: 'o1', name: 'Rage', type: 'number', value: 1, min: 0, max: 10 } as unknown as Stat;
    const stock = { id: 'o2', name: 'Stock', type: 'number', value: 1, min: 0, max: 10 } as unknown as Stat;
    const owned: Partial<DialogProps> = { owner: 'entity', ownerStats: [rage, stock], currentStatId: 'o1' };
    const code = 'return stats[{{source:stat}}].value;';

    it('lists the owner’s stats first and the world’s after them, each under its list', async () => {
      const user = userEvent.setup();
      await authoring(user, code, 'after', undefined, owned);

      await user.click(await screen.findByRole('combobox', { name: 'Source' }));
      expect(await rows()).toEqual(['StockOwner', 'WarmthWorld', 'DampWorld']);
    });

    it('inserts the owner’s route for an owner pick and the world’s for a world pick', async () => {
      const user = userEvent.setup();
      await authoring(user, code, 'after', undefined, owned);

      await user.click(await screen.findByRole('combobox', { name: 'Source' }));
      await user.click(screen.getByRole('option', { name: /^Stock/ }));
      await waitFor(() => expect(generated()).toContain('owner.stats["Stock"].value'));
      expect(screen.getByRole('combobox', { name: 'Source' })).toHaveTextContent('Stock');

      await user.click(screen.getByRole('combobox', { name: 'Source' }));
      await user.click(screen.getByRole('option', { name: /^Damp/ }));
      await waitFor(() => expect(generated()).toContain('return stats["Damp"].value;'));
      expect(generated()).not.toContain('owner.stats');
    });

    it('keeps two stats of one name apart by their list', async () => {
      const user = userEvent.setup();
      const twin = { ...stock, id: 'o3', name: 'Damp' } as Stat;
      await authoring(user, code, 'after', undefined, { ...owned, ownerStats: [rage, twin] });

      await user.click(await screen.findByRole('combobox', { name: 'Source' }));
      expect(await rows()).toEqual(['DampOwner', 'WarmthWorld', 'DampWorld']);
      await user.click(screen.getAllByRole('option', { name: /^Damp/ })[0]);
      await waitFor(() => expect(generated()).toContain('owner.stats["Damp"]'));
    });

    it('lists a Blueprint stat’s group the same way', async () => {
      const user = userEvent.setup();
      await authoring(user, code, 'after', undefined, { ...owned, owner: 'blueprint', ownerStats: [stock] });

      await user.click(await screen.findByRole('combobox', { name: 'Source' }));
      expect(await rows()).toEqual(['StockOwner', 'WarmthWorld', 'DampWorld']);
    });

    describe('a plain trait slot', () => {
      const traitCode = 'return traits[{{t:trait}}].enabled;';
      const miraTraits = entityTraitNames({ traits, traitGroups, entities, entityGroups }, [])[0].traits;
      const world = ['Storm TouchedLineage › Storms', 'HeirLineage', 'CursedWorld'];

      it('lists the entity’s own traits first under Owner, then the world’s, and fills `owner.traits`', async () => {
        const user = userEvent.setup();
        await authoring(user, traitCode, 'after', undefined, { ...owned, ownerTraits: miraTraits });

        await user.click(await screen.findByRole('combobox', { name: 'T' }));
        expect(await rows()).toEqual(['WoundedOwner › Scars', 'CalmOwner', ...world]);
        await user.click(screen.getByRole('option', { name: /^Wounded/ }));
        await waitFor(() => expect(generated()).toContain('return owner.traits["Wounded"].enabled;'));
        expect(screen.getByRole('combobox', { name: 'T' })).toHaveTextContent('Wounded');

        await user.click(screen.getByRole('combobox', { name: 'T' }));
        await user.click(screen.getByRole('option', { name: /^Cursed/ }));
        await waitFor(() => expect(generated()).toContain('return traits["Cursed"].enabled;'));
      });

      it('lists the world’s traits only in a global or a Blueprint stat’s box', async () => {
        const user = userEvent.setup();
        await authoring(user, traitCode, 'after', undefined, { ...owned, owner: 'blueprint', ownerStats: [stock] });
        await user.click(await screen.findByRole('combobox', { name: 'T' }));
        expect(await rows()).toEqual(world);
      });
    });

    it('hands a built-in template’s owner pick to Insert as code', async () => {
      const user = userEvent.setup();
      const onInsert = vi.fn();
      open('after', entities, { ...owned, onInsert });
      await user.click(await screen.findByText('Inverse of Another Stat'));
      await user.click(await screen.findByRole('combobox', { name: 'Source' }));
      await user.click(await screen.findByRole('option', { name: /^Stock/ }));
      await user.click(screen.getByRole('button', { name: 'Insert Code' }));
      expect(onInsert.mock.calls[0][0]).toContain('const source = owner.stats["Stock"];');
    });
  });

  // The sandbox `traits` map holds world traits only, so an owned trait there would generate a name that never resolves.
  it('lists only the world’s traits in a plain trait slot, in Traits-tab order under their groups', async () => {
    const user = userEvent.setup();
    await authoring(user, 'traits[{{t:trait}}].enabled = true;');

    const slot = await screen.findByRole('combobox', { name: 'T' });
    expect(slot).toHaveTextContent('Pick a trait…');
    await user.click(slot);
    expect(await rows()).toEqual(['Storm TouchedLineage › Storms', 'HeirLineage', 'CursedWorld']);
    await user.click(screen.getByRole('option', { name: /^Storm Touched/ }));
    await waitFor(() => expect(generated()).toContain('traits["Storm Touched"]'));
    expect(slot).toHaveTextContent('Storm Touched');
  });

  it('narrows a trait slot to one group’s rows when the search names that group', async () => {
    const user = userEvent.setup();
    await authoring(user, 'traits[{{t:trait}}].enabled = true;');

    await user.click(await screen.findByRole('combobox', { name: 'T' }));
    await user.type(screen.getByPlaceholderText('Search traits'), 'storms');
    expect(await rows()).toEqual(['Storm TouchedLineage › Storms']);
    await user.clear(screen.getByPlaceholderText('Search traits'));
    await user.type(screen.getByPlaceholderText('Search traits'), 'lineage');
    expect(await rows()).toEqual(['Storm TouchedLineage › Storms', 'HeirLineage']);
  });

  it('lists the picked entity’s traits in a tied trait slot, and the persona’s in a persona one', async () => {
    const user = userEvent.setup();
    await authoring(user, 'entities[{{who:entity}}].traits[{{t:trait(who)}}]; persona.traits[{{p:trait(persona)}}];');
    await user.click(await screen.findByRole('combobox', { name: 'P' }));
    expect(await rows()).toEqual(['ScarredRook']);
    await user.click(await screen.findByRole('option', { name: /^Scarred/ }));
    // Entities-tab order, each under its Entity folders.
    await user.click(await screen.findByRole('combobox', { name: 'Who' }));
    expect(await rows()).toEqual(['MiraCrew › Deck', 'RookCrew', 'Ash']);
    await user.click(await screen.findByRole('option', { name: 'Ash' }));
    await user.click(await screen.findByRole('combobox', { name: 'T' }));
    expect(await rows()).toEqual(['Loyal']);
    await user.click(await screen.findByRole('option', { name: 'Loyal' }));

    await waitFor(() => expect(generated()).toContain('entities["Ash"].traits["Loyal"]'));
    expect(generated()).toContain('persona.traits["Scarred"]');

    // Another entity clears the trait picked from the last one's list.
    await user.click(await screen.findByRole('combobox', { name: 'Who' }));
    await user.click(await screen.findByRole('option', { name: /^Mira/ }));
    await waitFor(() => expect(generated()).toContain('entities["Mira"].traits[""]'));
  });

  describe('a stat slot tied to an entity or the persona', () => {
    const stat = (id: string, name: string): Stat =>
      ({ id, name, type: 'number', description: '', value: 1, min: 0, max: 10, regen: 0, descriptors: [] });
    const vale: Entity = { id: 'e4', name: 'Vale', order: 2, persona: true, stats: [stat('v1', 'Nerve')] };
    const cast: Entity[] = [
      { ...entities[0], stats: [stat('m1', 'Grit'), stat('m2', 'Hunger')] },
      { ...entities[1], stats: [stat('a1', 'Faith')] },
      { ...entities[2], stats: [stat('r1', 'Nerve'), stat('r2', 'Luck')] },
      vale,
    ];

    it('lists the picked entity’s stats, fills its route, and clears when the entity changes', async () => {
      const user = userEvent.setup();
      await authoring(user, 'entities[{{who:entity}}].stats[{{s:stat(who)}}].value;', 'after', cast);

      await user.click(await screen.findByRole('combobox', { name: 'S' }));
      expect(screen.queryAllByRole('option')).toEqual([]);
      await user.keyboard('{Escape}');
      await user.click(await screen.findByRole('combobox', { name: 'Who' }));
      await user.click(await screen.findByRole('option', { name: /^Mira/ }));
      await user.click(screen.getByRole('combobox', { name: 'S' }));
      expect(await rows()).toEqual(['Grit', 'Hunger']);
      await user.click(screen.getByRole('option', { name: 'Hunger' }));
      await waitFor(() => expect(generated()).toContain('entities["Mira"].stats["Hunger"].value'));

      await user.click(screen.getByRole('combobox', { name: 'Who' }));
      await user.click(await screen.findByRole('option', { name: 'Ash' }));
      await waitFor(() => expect(generated()).toContain('entities["Ash"].stats[""].value'));
      await user.click(screen.getByRole('combobox', { name: 'S' }));
      expect(await rows()).toEqual(['Faith']);
    });

    it('lists each persona entity’s stats under its name, and fills `persona.stats`', async () => {
      const user = userEvent.setup();
      await authoring(user, 'persona.stats[{{s:stat(persona)}}].value;', 'after', cast);

      await user.click(await screen.findByRole('combobox', { name: 'S' }));
      expect(await rows()).toEqual(['NerveRook', 'LuckRook', 'NerveVale']);
      await user.click(screen.getByRole('option', { name: /^Luck/ }));
      await waitFor(() => expect(generated()).toContain('persona.stats["Luck"].value'));
    });

    it('lists the world’s stats for a loose tie', async () => {
      const user = userEvent.setup();
      await authoring(user, 'stats[{{s:stat(nobody)}}].value;', 'after', cast);

      await user.click(await screen.findByRole('combobox', { name: 'S' }));
      expect(await rows()).toEqual(['Damp']);
    });
  });

  it('lists the picked entity’s traits in its own tree order under its own groups, and follows the pick', async () => {
    const user = userEvent.setup();
    await authoring(user, 'entities[{{who:entity}}].traits[{{t:trait(who)}}];');

    await user.click(await screen.findByRole('combobox', { name: 'Who' }));
    await user.click(await screen.findByRole('option', { name: /^Mira/ }));
    await user.click(screen.getByRole('combobox', { name: 'T' }));
    expect(await rows()).toEqual(['WoundedScars', 'Calm']);
    await user.click(screen.getByRole('option', { name: /^Wounded/ }));
    await waitFor(() => expect(generated()).toContain('entities["Mira"].traits["Wounded"]'));

    await user.click(screen.getByRole('combobox', { name: 'Who' }));
    await user.click(await screen.findByRole('option', { name: /^Rook/ }));
    await user.click(screen.getByRole('combobox', { name: 'T' }));
    expect(await rows()).toEqual(['Scarred']);
  });

  // `persona.traits` reads by name, so a name two personas share is one value under either owner.
  it('lists each persona entity’s traits under its name and groups, a shared name under both', async () => {
    const user = userEvent.setup();
    const vale: Entity = {
      id: 'e4', name: 'Vale', order: 2, persona: true,
      traitGroups: [{ id: 'marks', name: 'Marks', parentId: null, order: 0 }],
      traits: [{ ...owned('keen', 'Keen'), order: 1 }, owned('vale-scarred', 'Scarred', 'marks')],
    };
    await authoring(user, 'persona.traits[{{p:trait(persona)}}];', 'after', [...entities, vale]);

    const slot = await screen.findByRole('combobox', { name: 'P' });
    await user.click(slot);
    expect(await rows()).toEqual(['ScarredRook', 'ScarredVale › Marks', 'KeenVale']);
    await user.click(screen.getAllByRole('option')[0]);
    await waitFor(() => expect(generated()).toContain('persona.traits["Scarred"]'));

    // Both rows hold the picked value, and the other row writes the same code.
    await user.click(slot);
    const shared = (await screen.findAllByRole('option')).filter((option) => option.textContent?.startsWith('Scarred'));
    expect(shared.map((option) => option.getAttribute('data-state'))).toEqual(['checked', 'checked']);
    await user.click(shared[1]);
    await waitFor(() => expect(generated()).toContain('persona.traits["Scarred"]'));
    expect(slot).toHaveTextContent('Scarred');

    await user.click(slot);
    await user.type(screen.getByPlaceholderText('Search traits'), 'vale');
    expect(await rows()).toEqual(['ScarredVale › Marks', 'KeenVale']);
  });

  // The sandbox keys a shared name to the last authored entity, so its row and its traits are that one's.
  it('lists a name two entities share once, under the folders of the entity code reaches', async () => {
    const user = userEvent.setup();
    const twin: Entity = { id: 'e4', name: 'Mira', order: 2, traits: [owned('brave', 'Brave')] };
    await authoring(user, 'entities[{{who:entity}}].traits[{{t:trait(who)}}];', 'after', [...entities, twin]);

    await user.click(await screen.findByRole('combobox', { name: 'Who' }));
    expect(await rows()).toEqual(['RookCrew', 'Ash', 'Mira']);
    await user.click(screen.getByRole('option', { name: 'Mira' }));
    await user.click(screen.getByRole('combobox', { name: 'T' }));
    expect(await rows()).toEqual(['Brave']);
  });

  it('lets a declared entity slot named persona win over the persona tie, and lists the world’s traits for a loose tie', async () => {
    const user = userEvent.setup();
    await authoring(user, 'entities[{{persona:entity}}].traits[{{t:trait(persona)}}]; traits[{{w:trait(nobody)}}];');
    await user.click(await screen.findByRole('combobox', { name: 'Persona' }));
    await user.click(await screen.findByRole('option', { name: 'Ash' }));
    await user.click(await screen.findByRole('combobox', { name: 'T' }));
    expect(await rows()).toEqual(['Loyal']);
    await user.click(await screen.findByRole('option', { name: 'Loyal' }));
    await user.click(await screen.findByRole('combobox', { name: 'W' }));
    expect(await rows()).toEqual(['Storm TouchedLineage › Storms', 'HeirLineage', 'CursedWorld']);
  });

  it('fills a picked template’s stat, entity and tied trait slots from their pickers', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByText('Penalty From Entity Trait'));

    await user.click(await screen.findByRole('combobox', { name: 'Base' }));
    await user.click(await screen.findByRole('option', { name: 'Damp' }));
    await user.click(screen.getByRole('combobox', { name: 'Entity' }));
    await user.click(await screen.findByRole('option', { name: /^Rook/ }));
    await user.click(screen.getByRole('combobox', { name: 'Trait' }));
    expect(await rows()).toEqual(['Scarred']);
    await user.click(screen.getByRole('option', { name: 'Scarred' }));

    await waitFor(() => expect(generated()).toContain('stats["Damp"]'));
    expect(generated()).toContain('entities["Rook"].traits["Scarred"]');
    expect(screen.getByRole('combobox', { name: 'Entity' })).toHaveTextContent('Rook');
  });

  it('prefills the defaults of a template picked from the list', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByText('Hourly Change'));

    // The built-in declares -5 per hour; the picker must meet the author with that, not with a blank.
    await waitFor(() => expect(screen.getByLabelText('Rate Per Hour')).toHaveValue('-5'));
  });
});

describe('personal template boundaries', () => {
  it('routes library and file actions through supplied adapters', async () => {
    const user = userEvent.setup();
    const repository = {
      list: vi.fn(async () => [localTemplate]),
      save: vi.fn(async (template: CodeTemplate) => ({ ...template, id: template.id || 'saved-copy' })),
      remove: vi.fn(async () => {}),
      import: vi.fn(async () => 1),
    };
    const fileTransfer = {
      readImportPack: vi.fn(async () => JSON.stringify({
        formamorphTemplates: 1,
        appVersion: 'test',
        templates: [{ ...localTemplate, id: 'imported-template', name: 'Imported Demonstration' }],
      })),
      writeExportPack: vi.fn(),
    };

    render(
      <StatCodeTemplateDialog
        open
        onOpenChange={vi.fn()}
        timing="after"
        stats={stats}
        currentStatId="s1"
        hasExistingCode={false}
        onInsert={vi.fn()}
        repository={repository}
        fileTransfer={fileTransfer}
      />,
    );

    expect(await screen.findByText(localTemplate.name)).toBeInTheDocument();
    expect(repository.list).toHaveBeenCalled();

    await user.click(screen.getByLabelText('Import templates'));
    await waitFor(() => expect(repository.import).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'imported-template', name: 'Imported Demonstration' }),
    ]));

    await user.click(screen.getByLabelText('Export templates'));
    expect(fileTransfer.writeExportPack).toHaveBeenCalledWith(
      expect.stringContaining('Local Demonstration'),
      'stat-templates.json',
    );

    await user.click(screen.getByText(localTemplate.name));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(repository.remove).toHaveBeenCalledWith(localTemplate.id));

    await user.click(screen.getByRole('button', { name: 'Weighted Blend' }));
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    await user.click(screen.getByRole('button', { name: 'Save Template' }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: '', name: 'Weighted Blend Copy' }),
    ));
  });
});

describe('which templates a box offers', () => {
  it('lists the setup templates before the AI and the reacting ones after it', async () => {
    open('before');
    expect(await screen.findByRole('button', { name: 'Trait by Threshold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Opening Turn Value' })).toBeInTheDocument();
    // A drift template reads the turn's hours, which the before box has none of.
    expect(screen.queryByRole('button', { name: 'Hourly Change' })).toBeNull();
  });

  it('leaves a template that runs only before the AI out of the after menu', async () => {
    open('after');
    expect(await screen.findByRole('button', { name: 'Hourly Change' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Opening Turn Value' })).toBeNull();
  });

  // Start, Output and Switch read a zero clock delta, so a drift template does nothing there.
  it.each(['start', 'output', 'switch'] as const)('lists no clock-delta template in the %s menu', async (timing) => {
    open(timing);
    expect(await screen.findByRole('button', { name: /New Template/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hourly Change' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Regen Toward Target' })).toBeNull();
  });

  it.each(['before', 'after', 'start', 'switch'] as const)('lists Weighted Blend in the %s menu', async (timing) => {
    open(timing);
    expect(await screen.findByRole('button', { name: 'Weighted Blend' })).toBeInTheDocument();
  });

  it.each([
    ['start', ['Random Starting Value', 'Start From Persona Trait']],
    ['switch', ['Change When a Trait Switches', 'Mirror a Trait']],
    ['output', ['Replace a Word', 'Count a Word', 'Bold a Word Past a Threshold']],
  ] as const)('lists the %s-only templates in their own menu and no value formula in the output menu', async (timing, names) => {
    open(timing);
    for (const name of names) expect(await screen.findByRole('button', { name })).toBeInTheDocument();
    if (timing === 'output') expect(screen.queryByRole('button', { name: 'Weighted Blend' })).toBeNull();
  });

  it('keeps a start-only template out of the output menu', async () => {
    open('output');
    expect(await screen.findByRole('button', { name: 'Replace a Word' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Random Starting Value' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mirror a Trait' })).toBeNull();
  });

  it('fills only the selected template with primary and leaves the others a neutral hover', async () => {
    const user = userEvent.setup();
    open('after');
    const hourly = await screen.findByRole('button', { name: 'Hourly Change' });
    await user.click(hourly);

    expect(hourly).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(hourly).not.toHaveClass('bg-accent', 'hover:bg-secondary');
    const other = screen.getByRole('button', { name: 'Weighted Blend' });
    expect(other).toHaveClass('hover:bg-secondary');
    expect(other).not.toHaveClass('bg-primary');
  });

  it('names every box the selected template runs in', async () => {
    const user = userEvent.setup();
    open('after');
    await user.click(await screen.findByRole('button', { name: 'Hourly Change' }));
    expect(screen.getByText('Runs After the AI')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Weighted Blend' }));
    expect(screen.getByText('Runs Before the AI, After the AI, At Game Start, When a Trait Switches')).toBeInTheDocument();
  });

  it('shows only the author’s templates for this box', async () => {
    const repository = {
      list: vi.fn(async (): Promise<CodeTemplate[]> => [
        localTemplate,
        { ...localTemplate, id: 'setup-template', name: 'Setup Demonstration', timings: ['before'] },
        { id: 'tool', kind: 'worldTool', name: 'Tool Demonstration', description: '', code: 'return 1;', timings: ['after'] },
      ]),
      save: vi.fn(async (template: CodeTemplate) => template),
      remove: vi.fn(async () => {}),
      import: vi.fn(async () => 0),
    };
    render(
      <StatCodeTemplateDialog
        open
        onOpenChange={vi.fn()}
        timing="before"
        stats={stats}
        currentStatId="s1"
        hasExistingCode={false}
        onInsert={vi.fn()}
        repository={repository}
      />,
    );

    expect(await screen.findByText('Setup Demonstration')).toBeInTheDocument();
    expect(screen.queryByText('Local Demonstration')).toBeNull();
    expect(screen.queryByText('Tool Demonstration')).toBeNull();
  });

  // A template written while the before box was open runs in that box, with the field there to add more.
  it('starts a new template in the box its menu was opened from', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async (template: CodeTemplate) => ({ ...template, id: 'saved' }));
    render(
      <StatCodeTemplateDialog
        open
        onOpenChange={vi.fn()}
        timing="before"
        stats={stats}
        currentStatId="s1"
        hasExistingCode={false}
        onInsert={vi.fn()}
        repository={{ list: vi.fn(async () => []), save, remove: vi.fn(async () => {}), import: vi.fn(async () => 0) }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /New Template/i }));
    expect(await screen.findByRole('combobox', { name: 'Runs' })).toHaveTextContent('Before the AI');

    const name = await screen.findByLabelText('Name');
    await user.type(name, 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save Template' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'script', timings: ['before'] })));
  });

  it('lists a template saved with two timings in both menus, and in no other', async () => {
    const user = userEvent.setup();
    const library: CodeTemplate[] = [];
    const repository = {
      list: vi.fn(async () => [...library]),
      save: vi.fn(async (template: CodeTemplate) => { library.push({ ...template, id: 'two' }); return library[0]; }),
      remove: vi.fn(async () => {}),
      import: vi.fn(async () => 0),
    };
    const { unmount } = open('before', entities, { repository });
    await user.click(await screen.findByRole('button', { name: /New Template/i }));
    await user.type(await screen.findByLabelText('Name'), 'Twice');
    await user.click(screen.getByRole('combobox', { name: 'Runs' }));
    await user.click(await screen.findByRole('option', { name: /At Game Start/ }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Save Template' }));
    await waitFor(() => expect(library).toEqual([expect.objectContaining({ name: 'Twice', timings: ['before', 'start'] })]));
    unmount();

    for (const timing of ['before', 'start'] as const) {
      const shown = open(timing, entities, { repository });
      expect(await screen.findByRole('button', { name: 'Twice' }), timing).toBeInTheDocument();
      shown.unmount();
    }
    // A control that runs after the AI shows the library has loaded into that menu.
    library.push({ ...localTemplate, id: 'control', name: 'Control', timings: ['after'] });
    open('after', entities, { repository });
    expect(await screen.findByRole('button', { name: 'Control' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Twice' })).toBeNull();
  });

  it('blocks Save with no timing picked', async () => {
    const user = userEvent.setup();
    open('after');
    await user.click(await screen.findByRole('button', { name: /New Template/i }));
    await user.type(await screen.findByLabelText('Name'), 'Nowhere');
    await user.click(screen.getByRole('combobox', { name: 'Runs' }));
    await user.click(await screen.findByRole('option', { name: /After the AI/ }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Save Template' })).toBeDisabled();
  });
});
