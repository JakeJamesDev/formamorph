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
    expect(within(options).getByRole('checkbox', { name: 'Stats' })).toBeChecked();
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
    await user.click(within(dialog()).getByRole('checkbox', { name: 'Stats' }));
    expect(stored()).toBe('<ENTITIES|inscene.summary.nostats.xml>');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    options = await open(user);
    expect(within(options).getByRole('combobox', { name: 'Scope' })).toHaveTextContent('In Scene');
    expect(within(options).getByRole('radio', { name: 'Summary' })).toBeChecked();
    expect(within(options).getByRole('radio', { name: 'XML' })).toBeChecked();
    expect(within(options).getByRole('checkbox', { name: 'Stats' })).not.toBeChecked();
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
    expect(within(options).getByRole('checkbox', { name: 'Stats' })).toBeDisabled();
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
