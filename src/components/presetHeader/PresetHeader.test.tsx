import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PresetHeader } from './PresetHeader';
import { presetHeaderActions, type PresetHeaderHandlers } from '@/lib/presetHeaderActions';

/** Every handler but full screen, with confirmed destructive actions. */
function handlers() {
  return {
    duplicate: vi.fn(),
    rename: vi.fn(),
    import: vi.fn(),
    export: vi.fn(),
    publish: vi.fn(),
    reset: { run: vi.fn(), description: 'Reset every prompt in "Mine"?' },
    delete: { run: vi.fn(), description: 'Delete the "Mine" preset?' },
  };
}

function renderHeader(builtIn: boolean, h: PresetHeaderHandlers) {
  render(
    <PresetHeader
      label="Preset"
      testId="row"
      select={<button type="button" role="combobox" aria-label="Preset" aria-controls="none" aria-expanded={false} />}
      actions={presetHeaderActions(builtIn, h)}
    />,
  );
}

const MENU = 'Preset Actions';

/** The desktop row's controls by accessible name, the select as `select`. Both widths render in jsdom. */
const rowNames = () => Array.from(screen.getByTestId('row').querySelectorAll('button'))
  .filter((n) => n.getAttribute('aria-label') !== MENU)
  .map((n) => (n.getAttribute('role') === 'combobox' ? 'select' : n.getAttribute('aria-label')));

/** Opens the ⋯ menu and returns its items, separators as `---`, in order. */
async function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: MENU }));
  const menu = await screen.findByRole('menu');
  return Array.from(menu.querySelectorAll('[role="menuitem"], [role="separator"]'))
    .map((n) => (n.getAttribute('role') === 'separator' ? '---' : n.textContent));
}

const rowButton = (name: string) => within(screen.getByTestId('row')).getByRole('button', { name });

describe('PresetHeader', () => {
  it('puts destructive icons left of the select and file icons right', () => {
    renderHeader(false, handlers());
    expect(rowNames()).toEqual(['Delete', 'Reset', 'select', 'Duplicate', 'Rename', 'Import', 'Export', 'Publish']);
  });

  it('puts a heading in place of the label and select, with the same icons', () => {
    render(<PresetHeader heading="Edit Mine" testId="row" actions={presetHeaderActions(false, handlers())} />);
    expect(screen.getByRole('heading', { name: 'Edit Mine' })).toBeInTheDocument();
    expect(rowNames()).toEqual(['Delete', 'Reset', 'Duplicate', 'Rename', 'Import', 'Export', 'Publish']);
  });

  it('lists every action in the ⋯ menu, destructive last', async () => {
    renderHeader(false, handlers());
    expect(await openMenu()).toEqual(['Duplicate', 'Rename', 'Import', 'Export', 'Publish', '---', 'Reset', 'Delete']);
  });

  it('keeps Duplicate, Import and Export on a built-in preset', async () => {
    renderHeader(true, handlers());
    expect(rowNames()).toEqual(['select', 'Duplicate', 'Import', 'Export']);
    expect(await openMenu()).toEqual(['Duplicate', 'Import', 'Export']);
  });

  it('drops each action whose handler the surface does not pass', async () => {
    const { duplicate, rename, reset } = handlers();
    renderHeader(false, { duplicate, rename, reset });
    expect(rowNames()).toEqual(['Reset', 'select', 'Duplicate', 'Rename']);
    expect(await openMenu()).toEqual(['Duplicate', 'Rename', '---', 'Reset']);
  });

  it('runs a file action from the menu after the menu closes', async () => {
    const h = handlers();
    renderHeader(false, h);
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import' }));
    await waitFor(() => expect(h.import).toHaveBeenCalledOnce());
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('confirms Delete with the surface text before it runs', async () => {
    const h = handlers();
    renderHeader(false, h);
    fireEvent.click(rowButton('Delete'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Delete Preset');
    expect(dialog.textContent).toContain('Delete the "Mine" preset?');
    expect(h.delete.run).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(h.delete.run).toHaveBeenCalledOnce();
  });

  it('runs nothing and returns focus to the icon when a confirm is canceled', async () => {
    const h = handlers();
    renderHeader(false, h);
    const reset = rowButton('Reset');
    // A browser focuses a clicked button; jsdom does not.
    reset.focus();
    fireEvent.click(reset);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Reset Preset');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.activeElement).toBe(reset));
    expect(h.reset.run).not.toHaveBeenCalled();
  });

  it('draws only the icon row when the layout is wide', () => {
    render(<PresetHeader label="Preset" testId="row" layout="wide" actions={presetHeaderActions(false, handlers())} select={<span />} />);
    expect(rowNames()).toEqual(['Delete', 'Reset', 'Duplicate', 'Rename', 'Import', 'Export', 'Publish']);
    expect(screen.queryByRole('button', { name: MENU })).toBeNull();
  });

  it('draws only the ⋯ menu when the layout is narrow', async () => {
    render(<PresetHeader label="Preset" testId="row" layout="narrow" actions={presetHeaderActions(false, handlers())} select={<span />} />);
    expect(rowNames()).toEqual([]);
    expect(await openMenu()).toEqual(['Duplicate', 'Rename', 'Import', 'Export', 'Publish', '---', 'Reset', 'Delete']);
  });

  it('resets at once, with no confirm, from a plain handler', () => {
    const run = vi.fn();
    renderHeader(false, { reset: run });
    fireEvent.click(rowButton('Reset'));
    expect(run).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('titles a confirm with the surface title when it passes one', async () => {
    renderHeader(false, { delete: { run: vi.fn(), title: 'Delete Mascot', description: 'Delete "Mine"?' } });
    fireEvent.click(rowButton('Delete'));
    expect((await screen.findByRole('alertdialog')).textContent).toContain('Delete Mascot');
  });

  it('shows a longer tip on hover and keeps the label as the name', async () => {
    const actions = presetHeaderActions(false, { duplicate: vi.fn() }).map((action) => ({ ...action, tip: 'Make an editable copy' }));
    render(<TooltipProvider><PresetHeader label="Preset" testId="row" select={<span />} actions={actions} /></TooltipProvider>);
    expect(rowNames()).toEqual(['Duplicate']);
    await userEvent.hover(rowButton('Duplicate'));
    expect(await screen.findByText('Make an editable copy', { selector: 'div' })).toBeInTheDocument();
  });

  it('ends the file group with the full-screen toggle, named for the way it goes, on a built-in preset too', async () => {
    const toggle = vi.fn();
    renderHeader(true, { ...handlers(), fullscreen: { active: false, toggle } });
    expect(rowNames()).toEqual(['select', 'Duplicate', 'Import', 'Export', 'View full screen']);
    fireEvent.click(rowButton('View full screen'));
    expect(toggle).toHaveBeenCalledOnce();
    expect(presetHeaderActions(true, { fullscreen: { active: true, toggle } }).map((a) => a.label)).toEqual(['Exit full screen']);
  });

  it('returns focus to the ⋯ button when a confirm opened from the menu is canceled', async () => {
    renderHeader(false, handlers());
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: MENU })));
  });
});
