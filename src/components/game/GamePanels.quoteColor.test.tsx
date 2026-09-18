import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { QUOTE_CLASS } from '@/lib/quoteSegments';
import { renderMiddlePanel, type PanelHarness } from '@/test/gamePanels';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const TURNS = [
  {
    action: 'I tell her "we leave at dawn" and step back.',
    narration: 'Mira looks up. "Then we leave at dawn," she says.',
    turnId: 't1',
    choices: ['Wait'],
  },
];

/** One assistant turn with a saved scratchpad, for the reasoning aside. */
function turnWithReasoning(narration: string, reasoning: string): string {
  return JSON.stringify({
    narration, choices: [], stat_changes: [], reasoning: { text: reasoning, ms: 1200 },
  });
}

const spans = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>(`.${QUOTE_CLASS}`)].map((s) => s.textContent);

const narration = () => screen.getByTestId('narration');
/** The player's own line, which sits in the same list as the narration but outside its test id. */
const echo = (view: PanelHarness<unknown>) => {
  const label = [...view.container.querySelectorAll('strong')].find((s) => s.textContent === 'You:');
  if (!label?.parentElement) throw new Error('no player echo rendered');
  return label.parentElement;
};

describe('MiddlePanel — quote color', () => {
  it('colors quoted speech in the narration', () => {
    renderMiddlePanel({}, { turns: TURNS });
    expect(spans(narration())).toEqual(['"Then we leave at dawn,"']);
  });

  it('colors quoted speech in the player echo', () => {
    const view = renderMiddlePanel({}, { turns: TURNS });
    expect(spans(echo(view))).toEqual(['"we leave at dawn"']);
  });

  it('colors a turn read back from history the same as the live one', () => {
    const turns = [
      { action: 'ask', narration: 'She shrugs. "Later," she says.', turnId: 't1' },
      { action: 'wait', narration: 'He nods. "Now," he says.', turnId: 't2' },
    ];
    renderMiddlePanel({}, { turns, page: 1 });
    expect(spans(narration())).toEqual(['"Later,"']);
  });

  it('leaves the reasoning aside plain', () => {
    const view = renderMiddlePanel({}, {
      turns: TURNS,
      settings: (s) => s.setShowReasoning(true),
      seed: (gameplay) => gameplay.setDisplayedMessages([
        { role: 'user', content: 'walk the dock' },
        { role: 'assistant', content: turnWithReasoning('Mira nods.', 'She would say "later" if pushed.') },
      ]),
    });
    // The aside starts collapsed, so its body only exists once the header is open.
    fireEvent.click(screen.getByRole('button', { name: /Thought for/ }));
    expect(screen.getByText(/She would say/).textContent).toContain('"later"');
    expect(spans(view.container)).toEqual([]);
  });

  it('leaves the command preview plain', () => {
    const view = renderMiddlePanel({ commandPreview: true }, {
      turns: [],
      gameplayText: 'A bold **claim** and a spoken "line".',
    });
    expect(view.container.textContent).toContain('Markdown preview');
    expect(spans(view.container)).toEqual([]);
  });

  it('paints the spans by default and drops the hook when the setting goes off', () => {
    const view = renderMiddlePanel({}, { turns: TURNS });
    expect(document.documentElement.hasAttribute('data-quote-color')).toBe(true);

    act(() => view.settings().setQuoteColor(false));
    expect(document.documentElement.hasAttribute('data-quote-color')).toBe(false);
    // The span stays — only the rule that reads it goes away, so nothing re-renders the markdown.
    expect(spans(narration())).toEqual(['"Then we leave at dawn,"']);
  });
});
