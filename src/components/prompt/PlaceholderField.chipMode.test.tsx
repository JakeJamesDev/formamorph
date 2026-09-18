import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaceholderField from './PlaceholderField';
import PromptField from './PromptField';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { promptVocabulary } from '@/lib/chipVocabulary';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

/**
 * World | Unique in a placeholder chip's flyout. Every placeholder chip answers the question; a chip whose
 * roll cannot differ per placement shows the answer and says why it takes no input.
 */

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const world = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });
const unique = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'unique', placementId });

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge Landing', 'Marrow']) };
const hair: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['silver']) };
const kit: Placeholder = { id: 'kit', name: 'Kit', values: phValues(['rope', 'lamp']), roll: false };
const WORLD = [town, hair, kit];

const changes = vi.fn<(v: string) => void>();

function Field({ text }: { text: string }) {
  const [placeholders, setPlaceholders] = useState(WORLD);
  const [value, setValue] = useState(text);
  return (
    <PlaceholderStoreProvider value={placeholderStore(placeholders, setPlaceholders)}>
      <EditorPreviewRollsProvider>
        <PlaceholderField
          value={value}
          onChange={(v) => { changes(v); setValue(v); }}
          placeholders={placeholders}
        />
      </EditorPreviewRollsProvider>
    </PlaceholderStoreProvider>
  );
}

const openFlyout = (name: string) => userEvent.click(screen.getByText(name));
const modeItem = (label: string) => screen.getByRole('radio', { name: label });
const selected = (label: string) => modeItem(label).getAttribute('data-state') === 'on';

beforeEach(() => {
  localStorage.clear();
  changes.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('the mode control on a chip that can only be World', () => {
  it('shows World selected and both items disabled, on a Variable', async () => {
    render(<Field text={`She has ${world('hair', 'h1')} hair.`} />);
    await openFlyout('Hair');
    expect(selected('World')).toBe(true);
    expect(modeItem('World')).toBeDisabled();
    expect(modeItem('Unique')).toBeDisabled();
  });

  it('says why it takes no input, and what unlocks it', async () => {
    render(<Field text={`She has ${world('hair', 'h1')} hair.`} />);
    await openFlyout('Hair');
    expect(screen.getByText(/Unique would change nothing\. Unlocks once the placeholder can roll\./)).toBeInTheDocument();
  });

  it('shows the same on a plain Object', async () => {
    render(<Field text={`Pack: ${world('kit', 'k1')}.`} />);
    await openFlyout('Kit');
    expect(selected('World')).toBe(true);
    expect(modeItem('Unique')).toBeDisabled();
  });

  it('shows Unique selected, and rewrites no token, where the stored mode says Unique', async () => {
    render(<Field text={`She has ${unique('hair', 'h1')} hair.`} />);
    // A Unique placement reads as its own placement, so the chip names the mode beside the placeholder.
    await openFlyout('Hair (Unique)');
    expect(selected('Unique')).toBe(true);
    expect(selected('World')).toBe(false);
    expect(modeItem('Unique')).toBeDisabled();
    expect(changes).not.toHaveBeenCalled();
  });
});

describe('the mode control on a chip that can roll', () => {
  it('still switches the token between World and Unique', async () => {
    render(<Field text={`Welcome to ${world('town', 'p1')}.`} />);
    await openFlyout('Town');
    expect(modeItem('Unique')).toBeEnabled();
    await userEvent.click(modeItem('Unique'));
    expect(changes).toHaveBeenCalledTimes(1);
    expect(changes.mock.calls[0][0]).toContain(':unique:');
  });
});

describe('a prompt-variable chip', () => {
  it('offers no mode control', async () => {
    render(
      <PromptField
        value="at <LOCATION>."
        onChange={() => {}}
        vocabulary={promptVocabulary([])}
        previewValues={{ '<LOCATION>': "Sarah's Place" }}
      />,
    );
    await openFlyout('Location');
    expect(screen.queryByRole('radio', { name: 'World' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Unique' })).toBeNull();
  });
});
