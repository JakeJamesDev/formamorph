import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HELP_CHIP, helpChipVocabulary } from '@/lib/formaquestion/helpChips';
import { DEFAULT_HELP_PROMPTS, HELP_PROMPT_CHIPS } from '@/lib/formaquestion/helpPrompt';
import { PromptCompareDialog } from './PromptCompareDialog';

const DEFAULT = DEFAULT_HELP_PROMPTS.pick;
const VOCABULARY = helpChipVocabulary(HELP_PROMPT_CHIPS.pick);

function renderDialog(text: string) {
  return render(<PromptCompareDialog open onOpenChange={() => {}} name="Search Prompt" defaultText={DEFAULT} text={text} vocabulary={VOCABULARY} surface="formaquestionCompare" />);
}

const pre = () => within(screen.getByRole('dialog')).getByText((_, el) => el?.tagName === 'PRE');
const chipLabels = () => [...pre().querySelectorAll('[data-chip]')].map((el) => el.textContent);

describe('PromptCompareDialog on a help prompt', () => {
  it('marks the words the custom text added and removed', () => {
    renderDialog(DEFAULT.replace('best one first', 'sharpest one first'));
    expect([...pre().querySelectorAll('ins')].map((el) => el.textContent).join('')).toContain('sharpest');
    expect([...pre().querySelectorAll('del')].map((el) => el.textContent).join('')).toContain('best');
  });

  it('draws help chips as chips on both sides of the diff', () => {
    renderDialog(DEFAULT.replace(HELP_CHIP.replyFormat, ''));
    expect(chipLabels()).toEqual(['Search Limit', 'Reply Format']);
    expect(pre().querySelector('del [data-chip]')?.textContent).toBe('Reply Format');
    expect(pre().textContent).not.toContain('<PICK_LIMIT>');
  });

  it('keeps a chip whole next to a private-use character (sentinel allocation trap)', () => {
    // U+F8FF ends the sentinel block: a sentinel allocated past it would show as a CJK glyph.
    renderDialog(`${DEFAULT}\n`);
    expect(chipLabels()).toEqual(['Search Limit', 'Reply Format']);
    expect(pre().textContent).toContain('');
    expect(pre().textContent).not.toMatch(/[㐀-鿿]/);
  });

  it('reads a chip kept on both sides as unchanged when an earlier chip goes (shared sentinel trap)', () => {
    renderDialog(DEFAULT.replace(HELP_CHIP.pickLimit, 'three'));
    const kept = [...pre().querySelectorAll('[data-chip]')].filter((el) => !el.closest('ins, del'));
    expect(kept.map((el) => el.textContent)).toEqual(['Reply Format']);
  });

  it('shows the custom text as stored, with chips and no markup, in Raw', async () => {
    renderDialog(DEFAULT.replace('best one first', 'sharpest one first'));
    await userEvent.click(screen.getByRole('radio', { name: 'Raw' }));
    expect(pre().querySelectorAll('ins, del')).toHaveLength(0);
    expect(pre().textContent).toContain('sharpest');
    expect(chipLabels()).toEqual(['Search Limit', 'Reply Format']);
  });
});
