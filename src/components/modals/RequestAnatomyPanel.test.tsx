import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RequestAnatomyPanel } from './RequestAnatomyPanel';
import { composePreviewValues } from '@/lib/previewValuePool';
import type { AnatomyPreviewPrompts, AnatomyPreviewSettings } from '@/lib/anatomyPreview';
import { PARITY_PROMPTS } from '@/lib/turnPipeline/parityTestInputs';
import { allGroupedTabs } from '@/lib/promptGroups';
import { CONTEXT_LABELS, SOURCE_LABELS } from '@/lib/requestAnatomy';
import {
  defaultSystemPrompt, defaultNarrationUserPrompt, defaultRecapUserPrompt,
  defaultNowLinePrompt, defaultRehydrateUserPrompt, defaultOocDirectivePrompt,
} from '@/components/game/GamePrompts';

/**
 * The hub's own job on top of the preview builder: which condition toggles it offers, what it says when a
 * configuration sends nothing, and that a highlighted run is a way into the editor behind it. What the
 * toggles then draw is the builder's, and tested there.
 */

afterEach(cleanup);

const PROMPTS: AnatomyPreviewPrompts = {
  system: defaultSystemPrompt,
  recap: defaultRecapUserPrompt,
  now: defaultNowLinePrompt,
  recall: defaultRehydrateUserPrompt,
  turn: {
    ...PARITY_PROMPTS,
    narrationUser: defaultNarrationUserPrompt,
    oocDirective: defaultOocDirectivePrompt,
  },
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
  locationAutoApply: false,
};

const VALUES = composePreviewValues({
  paragraphLimit: 'none', maxTokens: 800, markdownOutput: true, sectionStyle: 'markdown',
  limitActiveCharacters: false, activeCharacterLimit: 3, language: 'English',
});

const show = (over: Partial<AnatomyPreviewSettings> = {}, tab = 'narration', onJump = () => {}) =>
  render(
    <RequestAnatomyPanel tab={tab} prompts={PROMPTS} values={VALUES} settings={{ ...SETTINGS, ...over }} onJump={onJump} />,
  );

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

  it('offers no toggle at all on a hub whose own pass reads none of the conditions', () => {
    for (const tab of allGroupedTabs().filter((t) => t !== 'narration')) {
      show({}, tab);
      for (const label of [RECAP, RECALL, BRACKETS]) expect(screen.queryByText(label)).toBeNull();
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

  it('draws a hub for every prompt in the rail', () => {
    for (const tab of allGroupedTabs()) {
      show({}, tab);
      expect(screen.getAllByText('System Prompt', { selector: 'h3' }).length).toBeGreaterThan(0);
      cleanup();
    }
  });

  it('captions the fan-out hubs as one request per character', () => {
    for (const tab of ['character', 'diary']) {
      show({}, tab);
      expect(screen.getByText(/per character in the scene/)).toBeInTheDocument();
      cleanup();
    }
  });
});

describe('RequestAnatomyPanel jumps', () => {
  /** The clickable runs on screen — the buttons an authored run becomes. */
  const runButtons = () => screen.getAllByRole('button').filter((b) => b.getAttribute('title')?.startsWith('Open the '));

  it('makes an authored run a way into the editor that owns it', () => {
    const onJump = vi.fn();
    show({ thinkingMode: 'off' }, 'choices', onJump);
    const system = runButtons().find((b) => b.title === `Open the ${SOURCE_LABELS['system-template']}`)!;
    fireEvent.click(system);
    expect(onJump).toHaveBeenCalledWith({ tab: 'choices', surface: 'system' });
  });

  it('sends a stacked narration line to its own field on the Messages view', () => {
    const onJump = vi.fn();
    show({ thinkingMode: 'off' }, 'narration', onJump);
    fireEvent.click(runButtons().find((b) => b.title === `Open the ${SOURCE_LABELS.recap}`)!);
    expect(onJump).toHaveBeenCalledWith({ tab: 'narration', surface: 'messages', field: 'recap' });
  });

  it('leaves the text the app assembled inert — there is nothing to open', () => {
    show({ thinkingMode: 'off' }, 'narration');
    const assembled = screen.getAllByText(`<${CONTEXT_LABELS.action}>`)[0];
    expect(assembled.closest('button')).toBeNull();
  });
});
