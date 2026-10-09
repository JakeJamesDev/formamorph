import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { setGameplayText } from '@/lib/gameplayTextStore';
import { renderMiddlePanel, type Settings } from '@/test/gamePanels';
import { CONTINUE_CHOICE } from '@/lib/choices';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const LIST = ['Open fire', 'Call out "Who\'s there?"'];
const buttons = (testId: string) => within(screen.getByTestId(testId)).getAllByRole('button');
const continueAlways = (settings: Settings) => settings.setContinueChoiceMode('always');

describe('the /choices test preview', () => {
  it('shows streaming choices disabled, with no continue choice yet', () => {
    renderMiddlePanel({ commandPreview: true, commandChoices: { list: LIST, settled: false } }, { turns: [], settings: continueAlways });
    expect(screen.getByText('Choices preview (/choices test)')).toBeTruthy();
    expect(buttons('choice-rows').map((b) => [b.textContent, (b as HTMLButtonElement).disabled])).toEqual([
      ['Open fire', true], ['Call out "Who\'s there?"', true],
    ]);
  });

  it('enables the choices and adds the continue choice once the turn settles', () => {
    renderMiddlePanel({ commandPreview: true, commandChoices: { list: LIST, settled: true } }, { turns: [], settings: continueAlways });
    expect(buttons('choice-rows').map((b) => [b.textContent, (b as HTMLButtonElement).disabled])).toEqual([
      ['Open fire', false], ['Call out "Who\'s there?"', false], [CONTINUE_CHOICE, false],
    ]);
  });

  it('leaves the continue choice out when the setting is off', () => {
    renderMiddlePanel(
      { commandPreview: true, commandChoices: { list: LIST, settled: true } },
      { turns: [], settings: (s) => s.setContinueChoiceMode('off') },
    );
    expect(buttons('choice-rows').map((b) => b.textContent)).toEqual(['Open fire', 'Call out "Who\'s there?"']);
  });

  it('shows Chat bubbles in the Chat layout', () => {
    renderMiddlePanel(
      { commandPreview: true, commandChoices: { list: LIST, settled: true } },
      { turns: [], settings: (s) => { s.setNarrationLayout('chat'); s.setContinueChoiceMode('always'); } },
    );
    expect(buttons('chat-choices').map((b) => b.textContent)).toEqual([...LIST, CONTINUE_CHOICE]);
  });

  it('plays as a live Pages turn in place of the story', () => {
    renderMiddlePanel(
      { commandPreview: true, commandChoices: { list: LIST, settled: true }, commandAction: 'I force the gate.' },
      { turns: [{ action: 'Look around', narration: 'A gull watches you.', turnId: 't1', choices: ['Leave'] }], gameplayText: 'The gate gives.' },
    );
    expect(screen.getByTestId('action-line').textContent).toBe('I force the gate.');
    expect(screen.getByTestId('preview-narration').textContent).toBe('The gate gives.');
    expect(screen.queryByTestId('narration')).toBeNull();
    expect(screen.getAllByTestId('choice-rows')).toHaveLength(1);
  });

  it('plays as a live Chat turn with the action in a player bubble', () => {
    renderMiddlePanel(
      { commandPreview: true, commandChoices: { list: LIST, settled: true }, commandAction: 'I force the gate.' },
      { turns: [{ action: 'Look around', narration: 'A gull watches you.', turnId: 't1' }], gameplayText: 'The gate gives.', settings: (s) => s.setNarrationLayout('chat') },
    );
    expect(screen.getByText('I force the gate.')).toBeTruthy();
    expect(screen.getByTestId('preview-narration').textContent).toBe('The gate gives.');
    expect(screen.queryByText('A gull watches you.')).toBeNull();
  });

  it("fades in the next run's first sentence instead of showing it at once", () => {
    const durations = () => [...screen.getByTestId('preview-narration').querySelectorAll<HTMLElement>('[data-sd-animate]')]
      .map((w) => w.style.getPropertyValue('--sd-duration'));
    const view = renderMiddlePanel({ commandPreview: true, commandRunId: 1 }, { turns: [], gameplayText: 'One two three. Four five six.' });
    act(() => { view.setProps({ commandRunId: 2 }); setGameplayText(''); });
    act(() => setGameplayText('One two three.'));
    expect(durations().length).toBe(3);
    expect(durations()).not.toContain('0ms');
  });

  it('leaves the action line last in the card until narration arrives', () => {
    renderMiddlePanel({ commandPreview: true, commandChoices: { list: [], settled: false }, commandAction: 'I force the gate.' }, { turns: [] });
    expect(screen.queryByTestId('preview-narration')).toBeNull();
    expect(screen.getByTestId('action-line').nextElementSibling).toBeNull();
  });

  it('shows no choices for a narration-only preview', () => {
    renderMiddlePanel({ commandPreview: true }, { turns: [] });
    expect(screen.getByText('Markdown preview (/markdown test)')).toBeTruthy();
    expect(screen.queryByTestId('choice-rows')).toBeNull();
  });
});

describe('slash-command completion in the action box', () => {
  const box = () => screen.getByPlaceholderText(/Type your action/) as HTMLTextAreaElement;
  const rows = () => screen.queryAllByRole('button').filter((b) => b.closest('.bg-popover')).map((b) => b.textContent);
  const type = (value: string) => {
    fireEvent.focus(box());
    fireEvent.change(box(), { target: { value, selectionStart: value.length } });
  };

  it('lists the commands on a slash, then the next word after each pick', () => {
    renderMiddlePanel({}, { turns: [] });
    type('/');
    expect(rows()).toEqual(['choices', 'markdown']);
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(box().value).toBe('/markdown ');
    expect(rows()).toEqual(['test']);
    fireEvent.keyDown(box(), { key: 'Tab' });
    expect(box().value).toBe('/markdown test ');
    expect(rows()).toContain('slow');
  });

  it('shuts on Escape and on a word typed in full, so Enter reaches the box', () => {
    const onKey = vi.fn();
    renderMiddlePanel({ handleKeyPress: onKey }, { turns: [] });
    type('/ch');
    expect(rows()).toEqual(['choices']);
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(rows()).toEqual([]);
    type('/choices test slow');
    expect(rows()).toEqual([]);
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onKey).toHaveBeenCalled();
  });
});
