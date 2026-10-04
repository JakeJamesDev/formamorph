import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { PresetHeader } from './PresetHeader';
import { presetHeaderActions, type PresetHeaderHandlers } from '@/lib/presetHeaderActions';

function handlers(): Required<PresetHeaderHandlers> {
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

  it('returns focus to the ⋯ button when a confirm opened from the menu is canceled', async () => {
    renderHeader(false, handlers());
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: MENU })));
  });
});
