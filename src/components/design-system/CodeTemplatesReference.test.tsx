import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CodeTemplatesReference } from './CodeTemplatesReference';

const renderReference = () => render(
  <TooltipProvider>
    <CodeTemplatesReference />
  </TooltipProvider>,
);

describe('code templates design reference', () => {
  it('validates real template inputs and inserts generated code into the local sample', async () => {
    const user = userEvent.setup();
    renderReference();

    await user.click(screen.getByRole('button', { name: 'Open Code Templates' }));
    const dialog = await screen.findByRole('dialog', { name: 'Code Templates' });
    const insert = within(dialog).getByRole('button', { name: 'Insert Code' });

    expect(within(dialog).getAllByText('Required')).toHaveLength(2);
    expect(insert).toBeDisabled();

    const firstStat = within(dialog).getByRole('combobox', { name: 'First Stat' });
    expect(firstStat).toHaveAttribute('aria-invalid', 'true');
    expect(firstStat).toHaveAccessibleDescription('Required');
    await user.click(firstStat);
    await user.click(await screen.findByRole('option', { name: 'Warmth' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Second Stat' }));
    await user.click(await screen.findByRole('option', { name: 'Fatigue' }));

    const weight = within(dialog).getByRole('textbox', { name: 'Weight' });
    await user.clear(weight);
    await user.type(weight, 'invalid');
    expect(within(dialog).getByText('Must be a number')).toBeInTheDocument();
    expect(insert).toBeDisabled();

    await user.clear(weight);
    await user.type(weight, '0.25');
    expect(within(dialog).queryByText('Must be a number')).toBeNull();
    expect(dialog).toHaveTextContent('const weight = 0.25;');
    expect(insert).toBeEnabled();

    await user.click(insert);

    expect(screen.queryByRole('dialog', { name: 'Code Templates' })).toBeNull();
    const status = screen.getByText('The local sample stat code is updated.');
    expect(status).toBeInTheDocument();
    expect(status.closest('section')).toHaveTextContent('const weight = 0.25;');
  });

  it('keeps personal-template and file actions inside the local demonstration', async () => {
    const user = userEvent.setup();
    renderReference();
    const openDialog = () => user.click(screen.getByRole('button', { name: 'Open Code Templates' }));

    await openDialog();
    await user.click(await screen.findByLabelText('Import templates'));
    expect(await screen.findByRole('button', { name: 'Imported Local Demonstration' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('The local template library imported 1 template.')).toBeInTheDocument();

    await openDialog();
    await user.click(await screen.findByLabelText('Export templates'));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('The local template export is ready.')).toBeInTheDocument();

    await openDialog();
    await user.click(await screen.findByRole('button', { name: 'Imported Local Demonstration' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(screen.queryByRole('button', { name: 'Imported Local Demonstration' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('The local template library erased the selected template.')).toBeInTheDocument();

    await openDialog();
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    await user.click(screen.getByRole('button', { name: 'Save Template' }));
    expect(await screen.findByRole('button', { name: 'Weighted Blend Copy' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('The local template library saved “Weighted Blend Copy”.')).toBeInTheDocument();
  });
});
