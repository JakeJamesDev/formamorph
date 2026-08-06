import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { WorldOverview } from '@/types';
import WorldDetailsManager from './WorldDetailsManager';

const worldOverview = {
  name: 'Sedge Landing',
  description: '',
  tags: [],
  promptOverrides: { systemPrompt: 'You are the narrator. <LENGTH GUIDANCE>', systemPromptEnabled: true },
} as unknown as WorldOverview;

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({ worldOverview, updateWorldOverview: vi.fn(), placeholders: [] }),
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    paragraphLimit: 'single', maxTokens: 800, markdownOutput: true,
    activeSectionStyle: 'default', limitActiveCharacters: true, activeCharacterLimit: 5,
  }),
}));
vi.mock('@/lib/useDanbooruTags', () => ({ useDanbooruTags: () => [] }));
// The Lexical editor itself isn't under test — what matters is which props the manager hands it.
const fieldProps = vi.hoisted(() => ({ byLabel: {} as Record<string, Record<string, unknown>> }));
vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { ariaLabel?: string; previewValues?: Record<string, string> }) => {
    if (props.ariaLabel) fieldProps.byLabel[props.ariaLabel] = props;
    return <div data-testid={props.ariaLabel ?? 'prompt-field'} />;
  },
}));
vi.mock('@/components/prompt/PlaceholderField', () => ({ default: () => <div /> }));

describe('the world narration prompt field', () => {
  it('gives the editor something to preview, so it offers Preview and the split view', () => {
    render(<WorldDetailsManager />);
    const props = fieldProps.byLabel['World narration prompt'];

    // PromptField gates its Edit/Preview tabs — and the split view built on them — on having values to
    // resolve chips against. Without these the field is a bare textarea.
    expect(props).toBeDefined();
    expect(Object.keys(props.previewValues as Record<string, string>).length).toBeGreaterThan(0);
    expect(props.sampleData).toBe(true);
  });

  it('resolves the narration chips an author can actually insert', () => {
    render(<WorldDetailsManager />);
    const values = fieldProps.byLabel['World narration prompt'].previewValues as Record<string, string>;

    // A pool that resolved no real tokens would still be non-empty, so name a few the palette offers.
    for (const token of ['<ENTITIES>', '<LOCATION>', '<LENGTH GUIDANCE>']) {
      expect(values[token]).toBeTruthy();
    }
  });

  it('previews the guidance built from the player’s own settings, not a stand-in', () => {
    render(<WorldDetailsManager />);
    const values = fieldProps.byLabel['World narration prompt'].previewValues as Record<string, string>;

    // The mocked setting above is 'single'; a hardcoded sample would not track it.
    expect(values['<LENGTH GUIDANCE>']).toBe('Write a single paragraph.');
  });

  it('does not render the editor at all when the override is switched off', () => {
    worldOverview.promptOverrides = { systemPrompt: 'kept', systemPromptEnabled: false };
    render(<WorldDetailsManager />);

    expect(screen.queryByTestId('World narration prompt')).not.toBeInTheDocument();
    expect(screen.getByText(/Your prompt is kept/)).toBeInTheDocument();
    worldOverview.promptOverrides = { systemPrompt: 'You are the narrator.', systemPromptEnabled: true };
  });
});
