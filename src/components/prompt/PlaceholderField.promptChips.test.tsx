import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaceholderField from './PlaceholderField';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { PROMPT_KIND_VARIABLES } from '@/lib/promptVariables';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

/**
 * A world custom prompt: one field, two chip families. Prompt variables come from the field's own toolbar,
 * placeholders from the `{` trigger, and the stored text is the author's bytes.
 */

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const tone: Placeholder = { id: 'tone', name: 'Tone', values: phValues(['Keep a medium pace.']) };
const TONE_CHIP = encodePlaceholderToken({ id: 'tone', mode: 'world', placementId: 'place-1' });
const STORED = `Narrate.\n<NOTES|pre="Remember: ">\n${TONE_CHIP} <not a chip>`;

const changes = vi.fn<(v: string) => void>();

function Field({ text }: { text: string }) {
  const [placeholders, setPlaceholders] = useState([tone]);
  const [value, setValue] = useState(text);
  return (
    <PlaceholderStoreProvider value={placeholderStore(placeholders, setPlaceholders)}>
      <EditorPreviewRollsProvider>
        <PlaceholderField
          value={value}
          onChange={(v) => { changes(v); setValue(v); }}
          placeholders={placeholders}
          promptChips={{
            variables: PROMPT_KIND_VARIABLES.narration,
            previewValues: { '<NOTES>': 'the ferryman' },
          }}
          ariaLabel="World narration prompt"
        />
        <output>{value}</output>
      </EditorPreviewRollsProvider>
    </PlaceholderStoreProvider>
  );
}

const stored = () => screen.getByRole('status').textContent ?? '';
const editor = () => screen.getByRole('textbox', { name: 'World narration prompt' });
const chipTexts = () => [...editor().querySelectorAll('[data-lexical-decorator]')].map((el) => el.textContent?.trim());

beforeEach(() => {
  localStorage.clear();
  changes.mockReset();
});

describe('a custom prompt field with both chip families', () => {
  it('draws the placeholder chip and the prompt variable as chips, and rewrites nothing on load', () => {
    render(<Field text={STORED} />);
    // A prompt variable draws its affix on the chip.
    expect(chipTexts()).toEqual(['Remember: Notes', 'Tone']);
    expect(editor().textContent).not.toContain('{{ph:');
    expect(changes).not.toHaveBeenCalled();
  });

  it('keeps the stored text byte for byte through an edit', async () => {
    const user = userEvent.setup();
    render(<Field text={STORED} />);
    await user.click(editor());
    // jsdom lands a click's caret at the head of the field.
    await user.keyboard('!');
    await waitFor(() => expect(stored()).toBe(`!${STORED}`));
  });

  it('inserts a placeholder from the { trigger', async () => {
    const user = userEvent.setup();
    render(<Field text="Narrate." />);
    await user.click(editor());
    await user.keyboard('{{Tone');
    await screen.findByTestId('chip-typeahead');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(decodePlaceholderToken(stored().replace('Narrate.', ''))).toMatchObject({
      id: 'tone', mode: 'world',
    }));
    // A fresh placement, never the palette's own.
    expect(stored()).not.toContain(':palette');
  });

  it('leaves Player Name out of the menu, since a prompt names the player with the Persona variable', async () => {
    const user = userEvent.setup();
    render(<Field text="Narrate." />);
    await user.click(editor());
    await user.keyboard('{{');
    await screen.findByTestId('chip-typeahead');
    expect([...screen.getAllByTestId('chip-typeahead-row')].map((row) => row.textContent?.trim())).toEqual(['Tone']);
  });

  it('keeps the prompt-variable toolbar beside the trigger, and inserts from it', async () => {
    const user = userEvent.setup();
    render(<Field text="Narrate." />);
    await user.click(editor());
    await user.click(screen.getByRole('button', { name: 'Notes' }));
    await waitFor(() => expect(stored()).toContain('<NOTES>'));
    // The toolbar offers prompt variables only; placeholders come from the trigger and the shared palette.
    expect(screen.queryByRole('button', { name: 'Tone' })).not.toBeInTheDocument();
  });

  it('previews both families resolved', async () => {
    const user = userEvent.setup();
    render(<Field text={`<NOTES> / ${TONE_CHIP}`} />);
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    await waitFor(() => expect(screen.getByText(/the ferryman/)).toBeInTheDocument());
    expect(screen.getByText(/Keep a medium pace\./)).toBeInTheDocument();
  });
});
