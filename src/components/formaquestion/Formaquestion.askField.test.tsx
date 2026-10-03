import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { helpAi } from '@/test/helpAiFixture';
import { storeFramedWindow } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { Formaquestion } from './Formaquestion';

const PAGES = { Traits: '# 🧬 Traits\n\nA trait changes a stat.\n' };
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Traits](Traits)\n' }));

/** jsdom lays nothing out, so the text's height comes from here. */
const withScrollHeight = (px: number, run: () => void) => {
  const proto = window.HTMLTextAreaElement.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, 'scrollHeight');
  Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => px });
  try { run(); } finally {
    if (original) Object.defineProperty(proto, 'scrollHeight', original);
    else delete (proto as unknown as Record<string, unknown>).scrollHeight;
  }
};

async function openAsk() {
  render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  return screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Ask a Question' });
}

beforeEach(() => {
  localStorage.clear();
  storeFramedWindow();
  ai.current = helpAi();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the ask field', () => {
  it('starts as one line and grows with its text while focused, up to a cap', async () => {
    const field = await openAsk();
    expect(field).toHaveAttribute('rows', '1');

    withScrollHeight(120, () => {
      fireEvent.focus(field);
      fireEvent.change(field, { target: { value: 'a\nb\nc' } });
    });
    expect(field.style.height).toBe('120px');
    expect(field.style.overflowY).toBe('hidden');

    withScrollHeight(900, () => { fireEvent.change(field, { target: { value: 'long' } }); });
    expect(field.style.height).toBe('240px');
    expect(field.style.overflowY).toBe('auto');
  });

  it('is one line again on blur, with its text kept', async () => {
    const field = await openAsk();
    withScrollHeight(120, () => {
      fireEvent.focus(field);
      fireEvent.change(field, { target: { value: 'a\nb\nc' } });
      expect(field.style.height).toBe('120px');
      fireEvent.blur(field);
    });
    expect(field.style.height).toBe('');
    expect(field).toHaveClass('whitespace-nowrap');
    expect(field).toHaveValue('a\nb\nc');

    fireEvent.focus(field);
    expect(field).toHaveClass('whitespace-pre-wrap');
  });
});
