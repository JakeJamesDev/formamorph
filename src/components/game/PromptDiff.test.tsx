import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptDiff, PromptDiffModeToggle } from './PromptDiff';
import { SHIPPED_PROMPT_DEFAULTS } from '@/lib/worldPrompt';

/** The shipped narration prompt with one line reworded and one guideline dropped, as an author would. */
const REWORDED = 'grim, weather-beaten prose';
const authoredNarration = () =>
  SHIPPED_PROMPT_DEFAULTS.narration
    .replace('vivid second-person prose', REWORDED)
    .replace('## Background Lore\n<DICTIONARY|before>\n\n', '');

const insertions = (container: HTMLElement) =>
  [...container.querySelectorAll('ins')].map((el) => el.textContent).join('');
const deletions = (container: HTMLElement) =>
  [...container.querySelectorAll('del')].map((el) => el.textContent).join('');

/** What the rendered document reads as with one side's markup skipped — the two prompts it stands in for. */
const readingPast = (container: HTMLElement, skip: 'ins' | 'del') =>
  [...(container.querySelector('pre')?.childNodes ?? [])]
    .filter((node) => (node as HTMLElement).tagName?.toLowerCase() !== skip)
    .map((node) => node.textContent)
    .join('');

describe('PromptDiff', () => {
  it('marks up what the world added and what it dropped from the shipped default', () => {
    const { container } = render(
      <PromptDiff kind="narration" text={authoredNarration()} mode="changes" />,
    );
    // Punctuation and hyphens land in unchanged runs, so the wording is checked word by word.
    for (const word of ['grim', 'weather', 'beaten']) expect(insertions(container)).toContain(word);
    expect(deletions(container)).toContain('vivid');
    // The dropped section leaves its chip struck through whole rather than in pieces.
    expect(deletions(container)).toContain('<DICTIONARY|before>');
  });

  it('reads as the world’s prompt past the strikethroughs, and as the default past the insertions', () => {
    const text = authoredNarration();
    const { container } = render(<PromptDiff kind="narration" text={text} mode="changes" />);
    expect(readingPast(container, 'del')).toBe(text);
    expect(readingPast(container, 'ins')).toBe(SHIPPED_PROMPT_DEFAULTS.narration);
  });

  it('reads the whole default back when the world only added to it', () => {
    const { container } = render(
      <PromptDiff kind="choices" text={`${SHIPPED_PROMPT_DEFAULTS.choices}\n- One option must be risky.`} mode="changes" />,
    );
    expect(deletions(container)).toBe('');
    expect(insertions(container)).toContain('One option must be risky.');
    expect(container.textContent).toContain(SHIPPED_PROMPT_DEFAULTS.choices);
  });

  it('shows the world’s text exactly as authored in Raw, with no markup', () => {
    const text = authoredNarration();
    const { container } = render(<PromptDiff kind="narration" text={text} mode="raw" />);
    expect(container.textContent).toBe(text);
    expect(container.querySelectorAll('ins, del')).toHaveLength(0);
  });

  it('says nothing about a pass whose text matches the default', () => {
    const { container } = render(
      <PromptDiff kind="statUpdates" text={SHIPPED_PROMPT_DEFAULTS.statUpdates} mode="changes" />,
    );
    expect(container.querySelectorAll('ins, del')).toHaveLength(0);
    expect(container.textContent).toBe(SHIPPED_PROMPT_DEFAULTS.statUpdates);
  });
});

describe('PromptDiffModeToggle', () => {
  it('reports the mode picked', async () => {
    const onModeChange = vi.fn();
    render(<PromptDiffModeToggle mode="changes" onModeChange={onModeChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Raw' }));
    expect(onModeChange).toHaveBeenCalledWith('raw');
  });

  it('ignores the group clearing itself when the showing mode is clicked again', async () => {
    const onModeChange = vi.fn();
    render(<PromptDiffModeToggle mode="changes" onModeChange={onModeChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Changes' }));
    expect(onModeChange).not.toHaveBeenCalled();
  });
});
