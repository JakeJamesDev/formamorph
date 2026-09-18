import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from './theme-provider';
import { ThemePreviewButton } from './ThemePreviewDialog';
import { QUOTE_CLASS } from '@/lib/quoteSegments';
import { hexToHslTriple } from '@/lib/hslColor';

vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

afterEach(cleanup);

async function openDialog() {
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <SettingsProvider><ThemePreviewButton /></SettingsProvider>
    </ThemeProvider>,
  );
  await user.click(screen.getByRole('button', { name: /preview theme/i }));
  return screen.getByRole('dialog');
}

describe('ThemePreviewDialog dialogue token', () => {
  it('edits --dialogue and paints a sample quote with it', async () => {
    const dialog = await openDialog();
    const row = within(dialog).getByText('Dialogue').closest('label');
    expect(row).not.toBeNull();
    const picker = row!.querySelector('input[type="color"]') as HTMLInputElement;

    fireEvent.change(picker, { target: { value: '#3b82f6' } });

    const quote = dialog.querySelector(`.${QUOTE_CLASS}`) as HTMLElement;
    expect(quote).not.toBeNull();
    // jsdom does not resolve var(), so the edit is read where the quote inherits it: the preview wrapper.
    const wrapper = quote.parentElement!.closest('[style*="--dialogue:"]') as HTMLElement;
    expect(wrapper.style.getPropertyValue('--dialogue')).toBe(hexToHslTriple('#3b82f6'));
    expect(row!.textContent).toContain(hexToHslTriple('#3b82f6'));
  });
});
