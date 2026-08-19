import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { promptVocabulary } from '@/lib/chipVocabulary';
import { colorForToken, joinToken } from '@/lib/promptVariables';
import { tintValue, emptyMarker, stripTintSentinels, EMPTY_MARK_LABEL } from '@/lib/previewTint';

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

  it('leaves a marker where an affixed chip resolved to nothing', async () => {
    show(`at <LOCATION|name>.${notes}`);
    await openPreview();
    // The notes chip resolves to N/A, so the whole placement — label and value — drops out of what the
    // model receives. The preview still marks the spot, so a chip contributing nothing is visible.
    expect(screen.queryByText(/Notes:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/N\/A/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(EMPTY_MARK_LABEL)).toBeInTheDocument();
  });

  it('leaves a marker where a chip resolved to an empty value', async () => {
    render(
      <PromptField
        value="Notes: <NOTES>"
        onChange={() => {}}
        vocabulary={promptVocabulary([])}
        previewValues={{ '<NOTES>': '' }}
      />,
    );
    await openPreview();
    expect(screen.getByLabelText(EMPTY_MARK_LABEL)).toBeInTheDocument();
  });

  it('leaves no marker where every chip resolved to something', async () => {
    show(`at <LOCATION|name>${cast}.`);
    await openPreview();
    expect(screen.queryByLabelText(EMPTY_MARK_LABEL)).not.toBeInTheDocument();
  });

  it('still shows N/A for the same chip without affixes', async () => {
    show('Notes: <NOTES>');
    await openPreview();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('applies affixes in the markdown preview too', async () => {
    show(`at <LOCATION|name>${cast}.`, true);
    await openPreview();
    // Read past the tint markup: what the pane renders as prose is the same string the model receives.
    expect(stripTintSentinels(screen.getByTestId('md').textContent ?? ''))
      .toBe("at Sarah's Place with Mira present.");
  });
});

// The markdown preview can't wrap a value in an element itself — it hands the renderer one string — so it
// marks each value up with its chip's color for the renderer's tint plugin to turn back into a mark. What
// that markup becomes is covered against a real markdown parse in previewTint.test.ts; these guard that the
// pane marks up the right text with the right chip's color.
describe('the markdown preview hands the renderer tinted values', () => {
  it('marks up each resolved value in its own chip color', async () => {
    show(`at <LOCATION|name>${cast}.`, true);
    await openPreview();
    const location = tintValue("Sarah's Place", colorForToken('<LOCATION|name>'));
    const entities = tintValue(' with Mira present', colorForToken('<ENTITIES|name>'));
    expect(screen.getByTestId('md').textContent).toBe(`at ${location}${entities}.`);
  });

  it('marks the spot where a chip resolved to nothing', async () => {
    show(`at <LOCATION|name>.${notes}`, true);
    await openPreview();
    expect(screen.getByTestId('md').textContent).toContain(emptyMarker(colorForToken('<NOTES>')));
  });

  it('scrubs the tint markup out of author text and values before marking up', async () => {
    // Nothing typed or resolved may forge a pairing: a value carrying the marker characters would otherwise
    // close another chip's highlight early, or open one that swallows the rest of the pane.
    const forged = tintValue('x', colorForToken('<NOTES>'));
    render(
      <PromptField
        value={`${forged}at <LOCATION|name>.`}
        onChange={() => {}}
        vocabulary={promptVocabulary([])}
        previewValues={{ '<LOCATION|name>': `${forged}Sarah's Place` }}
        markdown
      />,
    );
    await openPreview();
    expect(screen.getByTestId('md').textContent)
      .toBe(`xat ${tintValue("xSarah's Place", colorForToken('<LOCATION|name>'))}.`);
  });

  it('leaves a chip-free field as plain markdown', async () => {
    show('just *prose*, no chips', true);
    await openPreview();
    expect(screen.getByTestId('md').textContent).toBe('just *prose*, no chips');
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
