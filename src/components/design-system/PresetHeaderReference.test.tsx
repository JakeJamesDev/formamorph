import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PresetHeaderReference } from './PresetHeaderReference';

const renderReference = () => render(<TooltipProvider><PresetHeaderReference /></TooltipProvider>);

/** The buttons in one sample's header row, in DOM order. The select reads as `select`. */
const rowNames = (sample: HTMLElement) => Array.from(sample.querySelectorAll('button'))
  .filter((n) => n.getAttribute('aria-label') !== null)
  .map((n) => (n.getAttribute('role') === 'combobox' ? 'select' : n.getAttribute('aria-label')));

describe('preset header reference', () => {
  it('draws the editable header as icons when wide and as one menu when narrow', async () => {
    const user = userEvent.setup();
    renderReference();
    expect(rowNames(screen.getByRole('region', { name: 'Editable, Wide' })))
      .toEqual(['Delete', 'Reset', 'select', 'Duplicate', 'Rename', 'Import', 'Export', 'Publish']);

    const narrow = screen.getByRole('region', { name: 'Editable, Narrow' });
    expect(rowNames(narrow)).toEqual(['select', 'Preset Actions']);
    await user.click(within(narrow).getByRole('button', { name: 'Preset Actions' }));
    expect((await screen.findAllByRole('menuitem')).map((n) => n.textContent))
      .toEqual(['Duplicate', 'Rename', 'Import', 'Export', 'Publish', 'Reset', 'Delete']);
  });

  it('keeps Duplicate, Import and Export on the built-in header', () => {
    renderReference();
    expect(rowNames(screen.getByRole('region', { name: 'Built-In, Wide' })))
      .toEqual(['select', 'Duplicate', 'Import', 'Export']);
  });

  it('offers no Import, Export or Publish on the endpoint header', () => {
    renderReference();
    expect(rowNames(screen.getByRole('region', { name: 'Endpoint, Wide' })))
      .toEqual(['Delete', 'Reset', 'select', 'Duplicate', 'Rename']);
  });

  it('hides Delete while one image preset remains and shows the heading form without a select', () => {
    renderReference();
    expect(rowNames(screen.getByRole('region', { name: 'Image, One Preset' })))
      .toEqual(['Reset', 'select', 'Duplicate', 'Rename']);
    const heading = screen.getByRole('region', { name: 'Heading Form' });
    expect(within(heading).getByRole('heading', { name: 'Edit Local Llama' })).toBeInTheDocument();
    expect(rowNames(heading)).toEqual(['Delete', 'Reset', 'Duplicate', 'Rename']);
  });

  it('shows no pair on a built-in prompt', () => {
    renderReference();
    const builtIn = screen.getByRole('region', { name: 'Built-In Prompt' });
    expect(within(builtIn).getByRole('textbox', { name: 'Built-In Narration Prompt' })).toHaveAttribute('readonly');
    expect(within(builtIn).queryByRole('button')).toBeNull();
  });

  it('shows each reachability state and no badge for the built-in engine', () => {
    renderReference();
    expect(within(screen.getByRole('region', { name: 'No Model Name' })).getByText('Reachable, but no model', { selector: 'span' })).toBeInTheDocument();
    const line = (region: string, text: string) => within(screen.getByRole('region', { name: region })).getByText(text, { exact: true, selector: 'span' });
    expect(line('Checking', 'Checking…')).toBeInTheDocument();
    expect(line('Reachable', 'Reachable')).toBeInTheDocument();
    expect(line('Missing Model', 'Reachable, but no "gemma-3-12b"')).toBeInTheDocument();
    expect(line('Unreachable', "Didn't answer")).toBeInTheDocument();
    expect(line('Not Checked', 'Not checked')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Built-In Engine' })).queryByRole('button', { name: 'Recheck' })).toBeNull();
  });

  it('runs a confirmed action only after the confirm and names the preset in it', async () => {
    const user = userEvent.setup();
    renderReference();
    const wide = screen.getByRole('region', { name: 'Editable, Wide' });
    await user.click(within(wide).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete the "Mine" preset?');
    expect(screen.getByRole('status')).toHaveTextContent('No action ran.');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('status')).toHaveTextContent('Ran Delete on the local sample.');
  });

  it('puts the pair in each placement, disabled while the text matches the default', async () => {
    const user = userEvent.setup();
    renderReference();
    const single = screen.getByRole('region', { name: 'Single Prompt' });
    expect(within(single).getByRole('button', { name: 'Reset Narration Prompt' })).toBeEnabled();
    expect(within(single).getByRole('button', { name: 'Compare Narration Prompt' })).toBeEnabled();

    const stacked = screen.getByRole('region', { name: 'Stacked Prompts' });
    expect(within(stacked).getByRole('button', { name: 'Reset Opening Message' })).toBeEnabled();
    expect(within(stacked).getByRole('button', { name: 'Reset Closing Message' })).toBeDisabled();
    expect(within(stacked).getByRole('button', { name: 'Compare Closing Message' })).toBeDisabled();

    await user.click(within(single).getByRole('button', { name: 'Reset Narration Prompt' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
    expect(within(single).getByRole('button', { name: 'Reset Narration Prompt' })).toBeDisabled();
    expect(within(single).getByRole('textbox', { name: 'Narration Prompt' }))
      .toHaveValue('Narrate the scene in second person. Keep each reply to three short paragraphs.');
  });
});
