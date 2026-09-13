import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Stat } from '@/types';
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

const open = (timing: StatCodeTiming = 'after') => render(
  <StatCodeTemplateDialog
    open
    onOpenChange={vi.fn()}
    timing={timing}
    stats={stats}
    currentStatId="s1"
    hasExistingCode={false}
    onInsert={vi.fn()}
    placeholderNames={['Mood', 'Hair Color']}
    traitNames={['Cursed']}
  />,
);

const localTemplate: StatCodeTemplate = {
  id: 'local-template',
  name: 'Local Demonstration',
  description: 'A controlled template.',
  code: 'return {{amount:number=2}};',
  timing: 'after',
};

/** Start a new template and replace its code with `code`. */
async function authoring(user: ReturnType<typeof userEvent.setup>, code: string, timing: StatCodeTiming = 'after') {
  open(timing);
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
    await user.click(await screen.findByRole('option', { name: 'Hair Color' }));
    await user.click(await screen.findByRole('combobox', { name: 'T' }));
    await user.click(await screen.findByRole('option', { name: 'Cursed' }));

    // The highlighter splits the code into token spans, so read the whole generated block.
    const generated = () => document.querySelector('pre')?.textContent ?? '';
    await waitFor(() => expect(generated()).toContain('placeholders["Hair Color"]'));
    expect(generated()).toContain('traits["Cursed"]');
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
    expect(screen.getByText('Runs After The AI')).toBeInTheDocument();
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
    expect(await screen.findByRole('combobox', { name: 'Runs' })).toHaveTextContent('Before The AI');

    const name = await screen.findByLabelText('Name');
    await user.type(name, 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save Template' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ timing: 'before' })));
  });
});
