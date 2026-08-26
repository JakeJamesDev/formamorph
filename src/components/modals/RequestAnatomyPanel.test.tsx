import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { RequestAnatomyPanel } from './RequestAnatomyPanel';
import { composePreviewValues } from '@/lib/previewValuePool';
import type { AnatomyPreviewPrompts, AnatomyPreviewSettings } from '@/lib/anatomyPreview';
import { CONTEXT_LABELS, SOURCE_LABELS } from '@/lib/requestAnatomy';
import {
  defaultSystemPrompt, defaultNarrationUserPrompt, defaultRecapUserPrompt,
  defaultNowLinePrompt, defaultRehydrateUserPrompt, defaultOocDirectivePrompt,
} from '@/components/game/GamePrompts';

/**
 * The panel's own job on top of the preview builder: which condition toggles it offers. A toggle whose
 * enabling settings are off is not rendered at all — the same rule that hides the editor it would
 * demonstrate. What the toggles then draw is the builder's, and tested there.
 */

afterEach(cleanup);

const PROMPTS: AnatomyPreviewPrompts = {
  system: defaultSystemPrompt,
  narrationUser: defaultNarrationUserPrompt,
  recap: defaultRecapUserPrompt,
  now: defaultNowLinePrompt,
  recall: defaultRehydrateUserPrompt,
  direction: defaultOocDirectivePrompt,
};

const SETTINGS: AnatomyPreviewSettings = {
  thinkingMode: 'off',
  sectionStyle: 'markdown',
  markdownOutput: true,
  paragraphLimit: 'none',
  language: 'English',
  maxTokens: 800,
  memoryDigests: true,
  semanticMemory: true,
  semanticRehydration: true,
  timeContext: false,
};

const VALUES = composePreviewValues({
  paragraphLimit: 'none', maxTokens: 800, markdownOutput: true, sectionStyle: 'markdown',
  limitActiveCharacters: false, activeCharacterLimit: 3, language: 'English',
});

const show = (over: Partial<AnatomyPreviewSettings> = {}) =>
  render(<RequestAnatomyPanel prompts={PROMPTS} values={VALUES} settings={{ ...SETTINGS, ...over }} />);

const RECAP = 'Memory Summaries condensed';
const RECALL = 'Scene Recall hit';
const BRACKETS = 'Bracketed action';

describe('RequestAnatomyPanel toggles', () => {
  it('offers all three conditions when every setting behind them is on', () => {
    show();
    for (const label of [RECAP, RECALL, BRACKETS]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('drops the recap and recall toggles with Memory Summaries off', () => {
    show({ memoryDigests: false });
    expect(screen.queryByText(RECAP)).toBeNull();
    expect(screen.queryByText(RECALL)).toBeNull();
    expect(screen.getByText(BRACKETS)).toBeInTheDocument();
  });

  it('drops only the recall toggle when Scene Recall itself is unavailable', () => {
    for (const off of [{ semanticMemory: false }, { semanticRehydration: false }]) {
      show(off);
      expect(screen.queryByText(RECALL)).toBeNull();
      expect(screen.getByText(RECAP)).toBeInTheDocument();
      cleanup();
    }
  });

  it('keeps the bracket toggle in every Thinking mode, since the bracket always rides the action', () => {
    for (const thinkingMode of ['off', 'precall', 'inline', 'staged'] as const) {
      show({ thinkingMode });
      expect(screen.getByText(BRACKETS)).toBeInTheDocument();
      cleanup();
    }
  });
});

describe('RequestAnatomyPanel preview', () => {
  it('draws the request under the settings it was handed, not a pinned configuration', () => {
    show({ thinkingMode: 'off' });
    expect(screen.getAllByText(SOURCE_LABELS['user-template']).length).toBeGreaterThan(0);
    expect(screen.getAllByText(SOURCE_LABELS.direction).length).toBeGreaterThan(0);
    cleanup();

    show({ thinkingMode: 'precall' });
    expect(screen.queryByText(SOURCE_LABELS['user-template'])).toBeNull();
    expect(screen.queryByText(SOURCE_LABELS.direction)).toBeNull();
    expect(screen.getAllByText(`<${CONTEXT_LABELS['turn-plan']}>`).length).toBeGreaterThan(0);
  });
});
