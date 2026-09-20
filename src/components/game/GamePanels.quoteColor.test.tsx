import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
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
/** The player's own line, which sits on the card with the narration but outside its test id. */
const echo = () => screen.getByTestId('action-line');

describe('MiddlePanel — quote color', () => {
  it('colors quoted speech in the narration', () => {
    renderMiddlePanel({}, { turns: TURNS });
    expect(spans(narration())).toEqual(['"Then we leave at dawn,"']);
  });

  it('colors quoted speech in the player echo', () => {
    renderMiddlePanel({}, { turns: [{ narration: 'The ferry lands.' }, ...TURNS] });
    expect(spans(echo())).toEqual(['"we leave at dawn"']);
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

  describe('choices', () => {
    const choice = (text: RegExp) => screen.getByRole('button', { name: text });
    const withChoices = (choices: string[]) => [{ ...TURNS[0], choices }];

    it('colors quoted speech in a choice', () => {
      renderMiddlePanel({}, { turns: withChoices(['Ask her "Where to?" and wait']) });
      expect(spans(choice(/Ask her/))).toEqual(['"Where to?"']);
    });

    it('keeps bold next to a quote and colors a quote around bold as one', () => {
      renderMiddlePanel({}, { turns: withChoices(['**Shout** "I **will** go" loudly']) });
      const button = choice(/Shout/);
      expect(button.textContent).toBe('Shout "I will go" loudly');
      const bold = [...button.querySelectorAll('strong')];
      expect(bold.map((s) => s.textContent)).toEqual(['Shout', 'will']);
      expect(spans(button)).toEqual(['"I ', 'will', ' go"']);
      // The bold word inside the quote carries the color; the one outside it does not.
      expect(spans(bold[1])).toEqual(['will']);
      expect(spans(bold[0])).toEqual([]);
    });

    it('shows a selected choice plain, against its filled background', () => {
      const view = renderMiddlePanel({}, { turns: withChoices(['Say "yes"', 'Say "no"']) });
      const quoteIn = (name: RegExp) => choice(name).querySelector<HTMLElement>(`.${QUOTE_CLASS}`);
      act(() => view.gameplay().setPlayerInput('Say "yes"'));
      // The span stays, so the italic setting still reaches it; only the color yields to the button's.
      expect(quoteIn(/yes/)?.style.color).toBe('inherit');
      expect(quoteIn(/no/)?.style.color).toBe('');
    });
  });

  it('paints the spans by default and drops the hook when the setting goes off', () => {
    const view = renderMiddlePanel({}, { turns: [{ ...TURNS[0], choices: ['Say "yes"'] }] });
    expect(document.documentElement.hasAttribute('data-quote-color')).toBe(true);

    act(() => view.settings().setQuoteColor(false));
    expect(document.documentElement.hasAttribute('data-quote-color')).toBe(false);
    // The span stays — only the rule that reads it goes away, so nothing re-renders the markdown.
    expect(spans(narration())).toEqual(['"Then we leave at dawn,"']);
    expect(spans(screen.getByRole('button', { name: /Say "yes"/ }))).toEqual(['"yes"']);
  });

  describe('custom color', () => {
    const root = document.documentElement;
    const custom = () => root.style.getPropertyValue('--dialogue-custom');
    /** Flips the mode class the way the theme provider does; the observer reports it on a microtask. */
    const switchMode = (from: string, to: string) => act(async () => { root.classList.replace(from, to); });

    beforeEach(() => root.classList.add('light'));
    afterEach(() => root.classList.remove('light', 'dark'));

    it('paints the active mode with its custom color, and reset hands it back to the theme', () => {
      const view = renderMiddlePanel({}, { turns: TURNS });
      expect(custom()).toBe('');

      act(() => view.settings().setQuoteColorLight('#c0392b'));
      expect(custom()).toBe('#c0392b');

      act(() => view.settings().setQuoteColorLight(null));
      expect(custom()).toBe('');
    });

    it('keeps a color per mode, so a mode switch shows the other value', async () => {
      const view = renderMiddlePanel({}, { turns: TURNS });
      act(() => view.settings().setQuoteColorLight('#c0392b'));

      await switchMode('light', 'dark');
      expect(custom()).toBe('');

      act(() => view.settings().setQuoteColorDark('#88ccff'));
      expect(custom()).toBe('#88ccff');

      await switchMode('dark', 'light');
      expect(custom()).toBe('#c0392b');
    });
  });
});
