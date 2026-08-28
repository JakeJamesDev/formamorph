import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { anchorElements, PROMPT_ANCHORS } from './previewScrollSync';
import { promptVocabulary } from '@/lib/chipVocabulary';

// Edit↔Preview scroll sync interpolates between anchors the two panes share, matched by position: the nth
// chip in Edit against the nth chip in Preview. Author `==highlights==` render as marks too, so anything
// that selects marks broadly picks them up and slides every later pairing out by one — the preview then
// follows the wrong part of the text. These render the real markdown preview (no renderer mock) so the
// author highlights genuinely reach the DOM.

const VALUES: Record<string, string> = {
  '<LOCATION|name>': "Sarah's Place",
  '<ENTITIES|name>': 'Mira',
};

async function preview(value: string) {
  render(
    <PromptField
      value={value}
      onChange={() => {}}
      vocabulary={promptVocabulary([])}
      previewValues={VALUES}
      markdown
    />,
  );
  await userEvent.click(screen.getByRole('tab', { name: 'Preview' }));
  return screen.getByTestId('prompt-preview');
}

describe('scroll-sync anchors', () => {
  it('anchors on the chips only, with author highlights interleaved between them', async () => {
    const pane = await preview('==first== <LOCATION|name> ==second== <ENTITIES|name> ==third==');
    // Three author highlights sit among the two chips; the anchors must still be the two chip values in order.
    expect(pane.querySelectorAll('mark').length).toBe(5);
    expect(anchorElements(pane, PROMPT_ANCHORS.preview).map((a) => a.textContent)).toEqual(["Sarah's Place", 'Mira']);
  });

  it('anchors on the chips only in the plain preview too', async () => {
    render(
      <PromptField
        value="==first== <LOCATION|name> ==second== <ENTITIES|name>"
        onChange={() => {}}
        vocabulary={promptVocabulary([])}
        previewValues={VALUES}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    const pane = screen.getByTestId('prompt-preview');
    // The plain pane never parses markdown, so its only marks are chips — but it shares the selector, and a
    // selector that ignored the brand would still have to be right here.
    expect(anchorElements(pane, PROMPT_ANCHORS.preview).map((a) => a.textContent)).toEqual(["Sarah's Place", 'Mira']);
  });

  it('anchors on the Lexical chips in the edit pane', async () => {
    render(
      <PromptField
        value="==first== <LOCATION|name> ==second== <ENTITIES|name>"
        onChange={() => {}}
        vocabulary={promptVocabulary([])}
        previewValues={VALUES}
        markdown
      />,
    );
    const editor = screen.getByRole('textbox');
    expect(anchorElements(editor, PROMPT_ANCHORS.edit)).toHaveLength(2);
  });
});
