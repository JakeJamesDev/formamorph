import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Entity, EntityGroup, Placeholder, PlaceholderGroup, Stat, Trait, TraitGroup } from '@/types';
import { entityTraitNames, worldTraitPlaces } from '@/lib/statCodeTraits';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { worldPlaceholderPlaces } from '@/lib/statCodePlaceholderPlaces';
import { StatCodeTemplateDialog } from './StatCodeTemplateDialog';
import type { StatCodeTiming } from '@/lib/statCodeTiming';
import type { StatCodeTemplate } from '@/lib/statCodeTemplates';

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

const open = (timing: StatCodeTiming = 'after', cast: Entity[] = entities) => render(
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
  />,
);

/** Each listed row's text: its name, then its breadcrumb. */
const rows = async () => (await screen.findAllByRole('option')).map((option) => option.textContent);
// The highlighter splits the code into token spans, so read the whole generated block.
const generated = () => document.querySelector('pre')?.textContent ?? '';

const localTemplate: StatCodeTemplate = {
  id: 'local-template',
  name: 'Local Demonstration',
  description: 'A controlled template.',
  code: 'return {{amount:number=2}};',
  timing: 'after',
};

/** Start a new template and replace its code with `code`. */
async function authoring(user: ReturnType<typeof userEvent.setup>, code: string, timing: StatCodeTiming = 'after', cast?: Entity[]) {
  open(timing, cast);
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

  // `persona.traits` reads by name, so a name two personas share is one value under either holder.
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
      save: vi.fn(async (template: StatCodeTemplate) => ({ ...template, id: template.id || 'saved-copy' })),
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

  it('leaves the before menu’s templates out of the after menu', async () => {
    open('after');
    expect(await screen.findByRole('button', { name: 'Hourly Change' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Opening Turn Value' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trait by Threshold' })).toBeNull();
  });

  it('names the box the selected template runs in', async () => {
    const user = userEvent.setup();
    open('after');
    await user.click(await screen.findByRole('button', { name: 'Hourly Change' }));
    expect(screen.getByText('Runs After the AI')).toBeInTheDocument();
  });

  it('shows only the author’s templates for this box', async () => {
    const repository = {
      list: vi.fn(async () => [
        localTemplate,
        { ...localTemplate, id: 'setup-template', name: 'Setup Demonstration', timing: 'before' as const },
      ]),
      save: vi.fn(async (template: StatCodeTemplate) => template),
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
  });

  // A template written while the before box was open belongs to that box, with the field there to move it.
  it('starts a new template in the box its menu was opened from', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async (template: StatCodeTemplate) => ({ ...template, id: 'saved' }));
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
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ timing: 'before' })));
  });
});
