// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';

vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

const root = document.documentElement;
const custom = () => root.style.getPropertyValue('--dialogue-custom');

/** Opens Settings on Display in the given mode, with custom colors already stored. */
function openSettings(mode: 'light' | 'dark', stored: { light?: string; dark?: string } = {}) {
  localStorage.setItem('vite-ui-theme', mode);
  if (stored.light) localStorage.setItem('FORMAMORPH_quoteColorLight', stored.light);
  if (stored.dark) localStorage.setItem('FORMAMORPH_quoteColorDark', stored.dark);
  return render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} initialTab="display" />
      </SettingsProvider>
    </ThemeProvider>,
  );
}

const field = (name: RegExp) => screen.queryByRole('button', { name });

/** The timed tutorial swallows Escape if it lands over an open picker, so the picker opens after it and outlives it. */
const tutorial = () => screen.findByRole('dialog', { name: 'Simple vs. Advanced' }, { timeout: 3000 });
async function openPicker(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const tip = await tutorial();
  await user.click(await screen.findByRole('button', { name }));
  await waitFor(() => expect(tip).not.toBeInTheDocument());
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  root.classList.remove('light', 'dark');
  root.style.removeProperty('--dialogue-custom');
});

describe('Settings — custom quote color', () => {
  it('shows the field only while Quote Color is on', async () => {
    const user = userEvent.setup();
    openSettings('light');
    expect(field(/Light Mode Color/)).toBeTruthy();

    await user.click(screen.getByRole('checkbox', { name: 'Quote Color' }));
    expect(field(/Light Mode Color/)).toBeNull();
  });

  it('edits the active mode only', async () => {
    const user = userEvent.setup();
    openSettings('dark');
    // The theme provider sets the mode class after mount; the root observer reports it a microtask later.
    await openPicker(user, /Dark Mode Color/);
    expect(field(/Light Mode Color/)).toBeNull();
    const hex = screen.getByRole('textbox', { name: 'Hex Color' });
    await user.clear(hex);
    await user.type(hex, '#88ccff');

    expect(custom()).toBe('#88ccff');

    const picker = screen.getByRole('textbox', { name: 'Hex Color' }).closest('[role="dialog"]');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(picker).not.toBeInTheDocument());
    await user.click(await screen.findByRole('radio', { name: 'Light' }));
    expect(field(/Light Mode Color/)).toBeTruthy();
    expect(custom()).toBe('');
  });

  it('resets the active mode to the theme and keeps the other mode', async () => {
    const user = userEvent.setup();
    openSettings('light', { light: '#c0392b', dark: '#88ccff' });
    expect(custom()).toBe('#c0392b');

    await openPicker(user, /Light Mode Color/);
    await user.click(screen.getByRole('button', { name: 'Reset to Theme' }));
    expect(custom()).toBe('');

    const picker = screen.getByRole('textbox', { name: 'Hex Color' }).closest('[role="dialog"]');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(picker).not.toBeInTheDocument());
    await user.click(await screen.findByRole('radio', { name: 'Dark' }));
    expect(field(/Dark Mode Color/)?.textContent).toContain('#88ccff');
    expect(custom()).toBe('#88ccff');
  });
});
