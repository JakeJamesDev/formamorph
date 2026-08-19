import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { promptVocabulary } from '@/lib/chipVocabulary';
import { joinToken } from '@/lib/promptVariables';

// The Preview tab must show what the MODEL receives, not a raw token — which means it has to apply each
// placement's affixes and the vanish-when-empty rule, exactly as renderPromptTemplate does. The value map
// is keyed by the affix-free token, so a naive `previewValues[token]` lookup misses every affixed chip and
// silently prints the token instead. These guard that.
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const VALUES: Record<string, string> = {
  '<ENTITIES|name>': 'Mira',
  '<LOCATION|name>': "Sarah's Place",
  '<NOTES>': 'N/A', // an absent standing note renders as the uniform placeholder
};

const cast = joinToken({ base: '<ENTITIES>', variantId: 'name', pre: ' with ', post: ' present' });
const notes = joinToken({ base: '<NOTES>', pre: ' Notes: ' });

function show(value: string, markdown = false) {
  render(
    <PromptField
      value={value}
      onChange={() => {}}
      vocabulary={promptVocabulary([])}
      previewValues={VALUES}
      markdown={markdown}
    />,
  );
}

async function openPreview() {
  await userEvent.click(screen.getByRole('tab', { name: 'Preview' }));
}

describe('PromptField preview resolves affixes', () => {
  it('wraps a present value in its affixes instead of printing the token', async () => {
    show(`at <LOCATION|name>${cast}.`);
    await openPreview();
    expect(screen.getByText(/Sarah's Place/)).toBeInTheDocument();
    expect(screen.getByText(/with Mira present/)).toBeInTheDocument();
    expect(screen.queryByText(/pre="/)).not.toBeInTheDocument();
  });

  it('shows an affixed chip with no value as nothing at all', async () => {
    show(`at <LOCATION|name>.${notes}`);
    await openPreview();
    // The notes chip resolves to N/A, so the whole placement — label and value — disappears.
    expect(screen.queryByText(/Notes:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/N\/A/)).not.toBeInTheDocument();
  });

  it('still shows N/A for the same chip without affixes', async () => {
    show('Notes: <NOTES>');
    await openPreview();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('applies affixes in the markdown preview too', async () => {
    show(`at <LOCATION|name>${cast}.`, true);
    await openPreview();
    expect(screen.getByTestId('md').textContent).toBe("at Sarah's Place with Mira present.");
  });
});

describe('the Edit/Preview toggle earns its place', () => {
  it('disables Preview on a plain field whose text has no chip', () => {
    // Values on offer but nothing in the text to swap: the preview would be character-identical to the
    // editor. The strip stays — hiding it would reflow the field around the caret on the first insert —
    // but Preview is not clickable.
    show('plain guidance, no chips at all');
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeDisabled();
  });

  it('enables Preview once the text embeds a chip', () => {
    show('at <LOCATION|name>.');
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeEnabled();
  });

  it('keeps Preview enabled on a chip-free markdown field, whose preview is the rendered prose', () => {
    show('just *prose*', true);
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeEnabled();
  });

  it('lands back on Edit when the open Preview loses its chips under it', async () => {
    // A preset switch or find-bar replace can swap the value while Preview is open. When the chips go,
    // Preview disables — and a disabled tab must not stay the active one.
    const { rerender } = render(
      <PromptField value="at <LOCATION|name>." onChange={() => {}} vocabulary={promptVocabulary([])} previewValues={VALUES} />,
    );
    await openPreview();
    expect(screen.getByTestId('prompt-preview')).toBeInTheDocument();

    rerender(
      <PromptField value="swapped to plain text" onChange={() => {}} vocabulary={promptVocabulary([])} previewValues={VALUES} />,
    );
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Edit' })).toHaveAttribute('data-state', 'active');
    expect(screen.queryByTestId('prompt-preview')).not.toBeInTheDocument();
  });
});
