import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import ChipInput from './ChipInput';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { variableAxes, variableForToken } from '@/lib/promptVariables';
import { promptVocabulary, usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { HELP_CHIP, helpChipVocabulary } from '@/lib/formaquestion/helpChips';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { phValues } from '@/test/placeholderValues';
import { renderReporting } from '@/test/surfaceReporter';
import type { Placeholder } from '@/types';

const vocabulary = promptVocabulary([]);

const entityOption = (axisId: string, optionId: string) =>
  variableAxes(variableForToken('<ENTITIES>')!).find((a) => a.id === axisId)!.options.find((o) => o.id === optionId)!.help!;
const SUMMARY_HELP = entityOption('content', 'summary');
const IN_SCENE_HELP = entityOption('scope', 'inscene');

function Field({ initial, readOnly = false }: { initial: string; readOnly?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <output data-testid="stored">{value}</output>
      <PromptField value={value} readOnly={readOnly} onChange={setValue} vocabulary={vocabulary} />
    </>
  );
}

const EYE: Placeholder[] = [{ id: 'eye', name: 'Eye', values: phValues(['blue', 'green']) }];

function PlaceholderHarness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <output data-testid="stored">{value}</output>
      <ChipInput value={value} onChange={setValue} vocabulary={usePlaceholderChipVocabulary(EYE)} ariaLabel="Name" />
    </>
  );
}

const stored = () => screen.getByTestId('stored').textContent;
const chip = () => document.querySelector<HTMLElement>('[data-chip]')!;
const dialog = () => screen.getByRole('dialog', { name: 'Chip Options' });
const row = (name: string) => within(dialog()).getByRole('group', { name });
const box = (rowName: string, name: string) => within(row(rowName)).getByRole('checkbox', { name });

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(chip());
  return dialog();
}

describe('Chip Options', () => {
  it('opens a dialog named Chip Options that names the chip', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES>" />);
    const options = await open(user);
    expect(within(options).getByText('Entities')).toBeInTheDocument();
    expect(surfaceRegistry.get().dialog).toBe('chipOptions');
  });

  it('gives a prompt chip the What the AI Reads pane', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES>" />);
    const options = await open(user);
    expect(within(options).getByRole('region', { name: 'What the AI Reads' })).toBeInTheDocument();
  });

  it('gives a placeholder chip one column with its Mode and Label rows', async () => {
    const user = userEvent.setup();
    renderReporting(<PlaceholderHarness initial={encodePlaceholderToken({ id: 'eye', mode: 'unique', placementId: 'p1' })} />);
    const options = await open(user);
    expect(within(options).queryByRole('region', { name: 'What the AI Reads' })).toBeNull();
    expect(within(options).getByRole('radio', { name: 'Unique' })).toBeChecked();
    await user.type(within(options).getByLabelText('Label'), 'Left');
    expect(stored()).toContain('Left');
  });

  it('shows Scope as a dropdown and Content and Format as segmented controls', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES>" />);
    const options = await open(user);
    expect(within(options).getByRole('combobox', { name: 'Scope' })).toHaveTextContent('Here');
    expect(within(options).getByRole('radiogroup', { name: 'Content' })).toBeInTheDocument();
    expect(within(options).getByRole('radiogroup', { name: 'Format' })).toBeInTheDocument();
    expect(box('Include', 'Stats')).toBeChecked();
  });

  it('writes each row to the token and reads it back on reopen, without closing between changes', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES>" />);
    let options = await open(user);
    await user.click(within(options).getByRole('combobox', { name: 'Scope' }));
    await user.click(await screen.findByRole('option', { name: 'In Scene' }));
    expect(dialog()).toBeInTheDocument();
    await user.click(within(dialog()).getByRole('radio', { name: 'Summary' }));
    await user.click(within(dialog()).getByRole('radio', { name: 'XML' }));
    await user.click(box('Include', 'Stats'));
    expect(stored()).toBe('<ENTITIES|inscene.summary.nostats.xml>');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    options = await open(user);
    expect(within(options).getByRole('combobox', { name: 'Scope' })).toHaveTextContent('In Scene');
    expect(within(options).getByRole('radio', { name: 'Summary' })).toBeChecked();
    expect(within(options).getByRole('radio', { name: 'XML' })).toBeChecked();
    expect(box('Include', 'Stats')).not.toBeChecked();
  });

  it('shows the roster rows in order and keeps every stored id through an edit', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES|withstats.notraits.nodescriptor>" />);
    const options = await open(user);
    expect(within(options).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Only With', 'Include', 'Stat Detail']);
    expect(box('Only With', 'Stats')).toBeChecked();
    expect(box('Only With', 'Traits')).not.toBeChecked();
    expect(box('Include', 'Traits')).not.toBeChecked();
    expect(box('Stat Detail', 'Descriptor')).not.toBeChecked();
    await user.click(within(options).getByRole('radio', { name: 'XML' }));
    expect(stored()).toBe('<ENTITIES|withstats.notraits.nodescriptor.xml>');
  });

  it('writes each new roster row and reads it back on reopen', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES>" />);
    await open(user);
    await user.click(box('Only With', 'Traits'));
    await user.click(box('Include', 'Traits'));
    await user.click(box('Stat Detail', 'Range'));
    expect(stored()).toBe('<ENTITIES|withtraits.notraits.norange>');
    await user.keyboard('{Escape}');
    await open(user);
    expect(box('Only With', 'Traits')).toBeChecked();
    expect(box('Include', 'Traits')).not.toBeChecked();
    expect(box('Stat Detail', 'Range')).not.toBeChecked();
  });

  it('disables Include and Stat Detail under Name content and leaves Only With live', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES|name>" />);
    await open(user);
    for (const checkbox of [box('Include', 'Traits'), box('Include', 'Stats'), box('Stat Detail', 'Range')]) expect(checkbox).toBeDisabled();
    await user.click(box('Only With', 'Stats'));
    expect(stored()).toBe('<ENTITIES|withstats.name>');
  });

  it('disables Stat Detail while stats are off and locks the last detail piece on', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES|nodescriptor.nodescription>" />);
    await open(user);
    expect(box('Stat Detail', 'Range')).toBeChecked();
    expect(box('Stat Detail', 'Range')).toBeDisabled();
    expect(box('Stat Detail', 'Descriptor')).toBeEnabled();
    await user.click(box('Include', 'Stats'));
    expect(stored()).toBe('<ENTITIES|nostats.nodescriptor.nodescription>');
    for (const name of ['Range', 'Descriptor', 'Description']) expect(box('Stat Detail', name)).toBeDisabled();
  });

  it('reads and writes all three Include Stats states per scope', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES|sublocations>" />);
    await open(user);
    expect(box('Include', 'Stats')).not.toBeChecked();
    await user.click(box('Include', 'Stats'));
    expect(stored()).toBe('<ENTITIES|sublocations.stats>');
    expect(box('Include', 'Stats')).toBeChecked();
    await user.click(box('Include', 'Stats'));
    expect(stored()).toBe('<ENTITIES|sublocations>');
    await user.click(within(dialog()).getByRole('combobox', { name: 'Scope' }));
    await user.click(await screen.findByRole('option', { name: 'In Scene' }));
    expect(stored()).toBe('<ENTITIES|inscene>');
    expect(box('Include', 'Stats')).toBeChecked();
  });

  it('shows a stored stats-on id on Reachable as checked', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES|reachable.stats>" />);
    await open(user);
    expect(box('Include', 'Stats')).toBeChecked();
    await user.click(box('Include', 'Stats'));
    expect(stored()).toBe('<ENTITIES|reachable>');
  });

  it('gives the Persona chip the same rows', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<PERSONA>" />);
    await open(user);
    expect(within(dialog()).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Only With', 'Include', 'Stat Detail']);
    await user.click(box('Only With', 'Stats'));
    await user.click(box('Include', 'Stats'));
    expect(stored()).toBe('<PERSONA|withstats.nostats>');
    expect(box('Stat Detail', 'Range')).toBeDisabled();
  });

  it('shows an option help line as the tooltip of its segment and its dropdown item', async () => {
    const user = userEvent.setup();
    renderReporting(<TooltipProvider><Field initial="<ENTITIES>" /></TooltipProvider>);
    const options = await open(user);
    await user.hover(within(options).getByRole('radio', { name: 'Summary' }));
    expect(await screen.findByText(SUMMARY_HELP)).toBeVisible();
    await user.click(within(options).getByRole('combobox', { name: 'Scope' }));
    await user.hover(await screen.findByRole('option', { name: 'In Scene' }));
    expect(await screen.findByText(IN_SCENE_HELP)).toBeVisible();
  });

  it.each([
    ['<ENTITIES|name>', 'Include'],
    ['<PERSONA|name>', 'Include'],
    ['<PERSONA|name>', 'Stat Detail'],
  ])('explains the disabled %s row on %s in words that fit the persona too', async (token, rowName) => {
    const user = userEvent.setup();
    renderReporting(<TooltipProvider><Field initial={token} /></TooltipProvider>);
    await open(user);
    await user.hover(within(dialog()).getByText(rowName));
    // The persona's Name content still sends pronouns, so the tip never says it sends only names.
    expect(await screen.findByText('Name content sends no stats or traits')).toBeVisible();
    expect(screen.queryByText(/only names/i)).toBeNull();
  });

  it('drops a stats id that means nothing when the scope changes', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES|reachable.stats>" />);
    await open(user);
    await user.click(within(dialog()).getByRole('combobox', { name: 'Scope' }));
    await user.click(await screen.findByRole('option', { name: 'Here' }));
    expect(stored()).toBe('<ENTITIES>');
    expect(box('Include', 'Stats')).toBeChecked();
  });

  it('stacks the panes below the small breakpoint, rows first', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES>" />);
    const options = await open(user);
    const reads = within(options).getByRole('region', { name: 'What the AI Reads' });
    const rows = within(options).getByRole('group', { name: 'Include' });
    const grid = reads.parentElement!;
    expect(grid.contains(rows)).toBe(true);
    // jsdom has no layout, so the contract is the class list: one column until `sm`, two from `sm` up.
    const classes = grid.className.split(/\s+/);
    expect(classes).toContain('grid');
    expect(classes.filter((name) => /^grid-cols-/.test(name))).toEqual([]);
    expect(classes.filter((name) => /^sm:grid-cols-\[.+\]$/.test(name))).toHaveLength(1);
    // The rows come before the pane in reading order, so the stack puts them on top.
    expect(rows.compareDocumentPosition(reads) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the Stats chip pieces as checkboxes and locks the last one on', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<STATS DESCRIPTION|numbers.descriptions>" />);
    const options = await open(user);
    const range = within(options).getByRole('checkbox', { name: 'Range' });
    const descriptor = within(options).getByRole('checkbox', { name: 'Descriptor' });
    expect(within(options).getByRole('checkbox', { name: 'Description' })).not.toBeChecked();
    await user.click(descriptor);
    expect(stored()).toBe('<STATS DESCRIPTION|numbers>');
    expect(range).toBeChecked();
    expect(range).toBeDisabled();
  });

  it('writes Header, Prepend and Append below the rows', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<LOCATION>" />);
    const options = await open(user);
    await user.type(within(options).getByLabelText('Header'), 'Here');
    await user.type(within(options).getByLabelText('Prepend'), 'At ');
    await user.type(within(options).getByLabelText('Append'), '.');
    expect(stored()).toBe('<LOCATION|pre="At "|post="."|header="Here">');
  });

  it('disables every control in a read-only field', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES|markdown>" readOnly />);
    const options = await open(user);
    expect(within(options).getByRole('combobox', { name: 'Scope' })).toBeDisabled();
    for (const radio of within(options).getAllByRole('radio')) expect(radio).toBeDisabled();
    for (const checkbox of within(options).getAllByRole('checkbox')) expect(checkbox).toBeDisabled();
    for (const name of ['Header', 'Prepend', 'Append']) expect(within(options).getByLabelText(name)).toBeDisabled();
    expect(stored()).toBe('<ENTITIES|markdown>');
  });

  it('closes on Escape without closing the dialog it sits in', async () => {
    const user = userEvent.setup();
    renderReporting(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <Field initial="<ENTITIES>" />
        </DialogContent>
      </Dialog>,
    );
    await open(user);
    await user.click(within(dialog()).getByRole('radio', { name: 'Summary' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Chip Options' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('closes on its close button', async () => {
    const user = userEvent.setup();
    renderReporting(<Field initial="<ENTITIES>" />);
    const options = await open(user);
    await user.click(within(options).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('swaps the body for the drill picker on Re-Pick and back again', async () => {
    const user = userEvent.setup();
    renderReporting(<PlaceholderHarness initial={encodePlaceholderToken({ id: 'eye', mode: 'world', placementId: 'p1' })} />);
    const options = await open(user);
    await user.click(within(options).getByRole('button', { name: /Re-Pick/ }));
    expect(within(dialog()).queryByRole('radio', { name: 'Unique' })).toBeNull();
    await user.click(within(dialog()).getByRole('button', { name: 'Back' }));
    expect(within(dialog()).getByRole('radio', { name: 'Unique' })).toBeInTheDocument();
  });

  it('gives a help prompt chip one column that says it has no options', async () => {
    const user = userEvent.setup();
    renderReporting(<PromptField value="<VOICE>" onChange={() => {}} vocabulary={helpChipVocabulary([HELP_CHIP.voice])} />);
    const options = await open(user);
    expect(within(options).queryByRole('region', { name: 'What the AI Reads' })).toBeNull();
    expect(within(options).getByText('No options for this variable.')).toBeInTheDocument();
  });
});
