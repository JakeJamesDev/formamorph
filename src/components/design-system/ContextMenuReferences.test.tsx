import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ContextMenuReferences } from './ContextMenuReferences';

const renderReferences = () => render(
  <TooltipProvider>
    <ContextMenuReferences />
  </TooltipProvider>,
);

const route = (subtab: string) => {
  window.location.hash = `#dev?modal=designSystem&tab=context-menu&subtab=${subtab}`;
  fireEvent(window, new Event('hashchange'));
};

const rightClick = (name: string) => fireEvent.contextMenu(screen.getByRole('button', { name }), { button: 2, clientX: 10, clientY: 10 });

afterEach(() => {
  window.location.hash = '';
  fireEvent(window, new Event('hashchange'));
});

describe('context menu references', () => {
  it('opens the detail line reference through the dev route and returns for the group dialogs', () => {
    renderReferences();
    expect(screen.getByRole('button', { name: /sample entity/i })).toBeInTheDocument();
    route('detail-line');
    expect(screen.getByRole('heading', { name: 'Item Detail Line' })).toBeInTheDocument();
    route('picker');
    expect(screen.getByRole('searchbox', { name: 'Find a Group' })).toBeInTheDocument();
  });

  it('names a routed item by its label and describes it with the endpoint line', async () => {
    const user = userEvent.setup();
    renderReferences();
    route('detail-line');
    rightClick('Sample narration');

    const regenerate = screen.getByRole('menuitem', { name: 'Re-generate Narration' });
    expect(regenerate).toHaveAttribute('aria-description', 'Sends to Default · default');
    expect(regenerate).toHaveTextContent('Sends to Default · default');
    expect(screen.getByRole('menuitem', { name: 'Re-generate Stats' })).toHaveAttribute('aria-description', 'Sends to Quick Stats · gemma-4-e4b');

    const edit = screen.getByRole('menuitem', { name: 'Edit' });
    expect(edit).not.toHaveAttribute('aria-description');
    expect(edit).not.toHaveAttribute('aria-label');

    await user.click(regenerate);
    expect(screen.getByRole('status')).toHaveTextContent('Re-generate Narration ran on the local sample.');
  });

  it('truncates a long endpoint line on one row', () => {
    renderReferences();
    route('detail-line');
    rightClick('Sample choices');

    const line = screen.getByText(/^Sends to Silver Siren/);
    expect(line).toHaveClass('truncate');
    expect(screen.getByRole('menuitem', { name: 'Re-generate Choices' })).toHaveAttribute('aria-description', line.textContent);
  });
});
