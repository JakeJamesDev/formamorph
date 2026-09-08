import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RichListReferences } from './RichListReferences';

const renderReference = () => render(
  <TooltipProvider>
    <RichListReferences />
  </TooltipProvider>,
);

describe('rich list references', () => {
  it('keeps World Editor list edits and actions in local sample state', async () => {
    const user = userEvent.setup();
    renderReference();

    const editor = screen.getByRole('region', { name: 'World Editor List' });
    await user.click(within(editor).getByText('The Clockwork Archivist With a Deliberately Long Name'));

    const name = within(editor).getByRole('textbox', { name: 'Selected Name' });
    await user.clear(name);
    await user.type(name, 'The Brass Archivist');
    expect(within(editor).getByText('The Brass Archivist')).toBeInTheDocument();

    await user.click(within(editor).getAllByRole('button', { name: 'Duplicate' })[0]);
    expect(within(editor).getByText('The Brass Archivist Copy')).toBeInTheDocument();

    await user.click(within(editor).getAllByRole('button', { name: 'Delete' })[0]);
    expect(within(editor).queryByText('The Brass Archivist')).not.toBeInTheDocument();
    expect(localStorage).toHaveLength(0);
  });

  it('keeps Save and Load list actions in local sample state', async () => {
    const user = userEvent.setup();
    renderReference();

    const saves = screen.getByRole('region', { name: 'Save and Load List' });
    const name = within(saves).getByRole('textbox', { name: 'Save Name' });
    await user.clear(name);
    await user.type(name, 'Before the Bell Rings');
    await user.click(within(saves).getByRole('button', { name: 'Save' }));
    expect(within(saves).getByText('Before the Bell Rings')).toBeInTheDocument();

    await user.click(within(saves).getByRole('button', { name: 'Load save “A Dockside Promise”' }));
    expect(within(saves).getByText('Loaded “A Dockside Promise”.')).toBeInTheDocument();

    await user.click(within(saves).getByRole('button', { name: 'Export save “A Dockside Promise”' }));
    expect(within(saves).getByText('Prepared “A Dockside Promise” for export.')).toBeInTheDocument();

    await user.click(within(saves).getByRole('button', { name: 'Delete save “A Dockside Promise”' }));
    expect(within(saves).queryByText('A Dockside Promise')).not.toBeInTheDocument();
    expect(localStorage).toHaveLength(0);
  });
});
