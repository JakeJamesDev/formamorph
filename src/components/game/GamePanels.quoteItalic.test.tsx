import { describe, it, expect, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import { QUOTE_CLASS } from '@/lib/quoteSegments';
import { renderMiddlePanel } from '@/test/gamePanels';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const TURNS = [
  { action: 'wait', narration: 'Mira looks up. "Then we leave at dawn," she says.', turnId: 't1' },
];

const root = () => document.documentElement;
const spans = () => [...screen.getByTestId('narration').querySelectorAll(`.${QUOTE_CLASS}`)].map((s) => s.textContent);

describe('MiddlePanel — quote italic', () => {
  it('is off by default', () => {
    renderMiddlePanel({}, { turns: TURNS });
    expect(root().hasAttribute('data-quote-italic')).toBe(false);
  });

  it('sets quotes in italic with the color off', () => {
    const view = renderMiddlePanel({}, { turns: TURNS });
    act(() => {
      view.settings().setQuoteColor(false);
      view.settings().setQuoteItalic(true);
    });
    expect(root().hasAttribute('data-quote-color')).toBe(false);
    expect(root().hasAttribute('data-quote-italic')).toBe(true);
    expect(spans()).toEqual(['"Then we leave at dawn,"']);

    act(() => view.settings().setQuoteItalic(false));
    expect(root().hasAttribute('data-quote-italic')).toBe(false);
  });
});
