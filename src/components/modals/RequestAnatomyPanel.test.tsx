import { useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RequestAnatomyPanel } from './RequestAnatomyPanel';
import { ANATOMY_RUN_ATTR, type AnatomyViewMode } from '@/components/game/RequestAnatomyView';
import type { PromptJumpTarget } from '@/lib/promptJump';
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
 * The hub's own job on top of the preview builder: which view it opens in and how the two flip, what it
 * says when a configuration sends nothing, and that a run or a chip is a way into what is behind it. What
 * a request then contains is the builder's, and tested there.
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

/** The panel's view mode lives with its caller, so the harness holds it the way Settings does. */
function Harness({ settings, tab, onJump, fullscreen }: {
  settings: AnatomyPreviewSettings;
  tab: string;
  onJump: (target: PromptJumpTarget) => void;
  fullscreen?: boolean;
}) {
  const [mode, setMode] = useState<AnatomyViewMode>('chips');
  return (
    <RequestAnatomyPanel
      tab={tab} prompts={PROMPTS} values={VALUES} settings={settings}
      mode={mode} onModeChange={setMode} onJump={onJump}
      fullscreen={fullscreen} onRequestFullscreen={fullscreen === undefined ? undefined : () => {}}
    />
  );
}

const show = (over: Partial<AnatomyPreviewSettings> = {}, tab = 'narration', onJump = () => {}) =>
  render(<Harness tab={tab} settings={{ ...SETTINGS, ...over }} onJump={onJump} />);

/** jsdom lays nothing out, so every box reports zero width. This is the panel's own measurement — the
 *  layout width the split is decided against. */
const atWidth = (px: number) => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(px);
};

const showFullscreen = (px: number) => {
  atWidth(px);
  return render(<Harness tab="narration" settings={SETTINGS} onJump={() => {}} fullscreen />);
};

/** The element that actually scrolls inside a pane. */
const viewport = () => document.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')!;

/** jsdom gives every box zero height, so a pane meant to be scrollable is told its own size. Stubbed on
 *  the prototype, since a flip mounts a pane that does not exist yet when the test sets this up. */
const scrollablePanes = ({ scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number }) => {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
};

/** The hub's own view bar — the same two-value bar the prompt editors carry over their panes. */
const modeTab = (label: 'Chips' | 'Preview') => screen.getByRole('tab', { name: label });

/** Flip the hub to the named view. Radix Tabs select on mousedown, which a plain click never sends. */
const showMode = (label: 'Chips' | 'Preview') => fireEvent.mouseDown(modeTab(label));

describe('RequestAnatomyPanel header', () => {
  it('says the one thing worth saying, with no toolbar of condition toggles', () => {
    show();
    expect(screen.getByText(/each blank shown as the chip that fills it/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('opens in Chips, so the whole request fits in one scan', () => {
    show();
    expect(modeTab('Chips')).toHaveAttribute('data-state', 'active');
    expect(modeTab('Preview')).toHaveAttribute('data-state', 'inactive');
  });

  it('flips to the resolved request and back, and says which it is showing', () => {
    show();
    showMode('Preview');
    expect(screen.getByText(/as the AI receives it/)).toBeInTheDocument();
    expect(modeTab('Preview')).toHaveAttribute('data-state', 'active');
    showMode('Chips');
    expect(modeTab('Chips')).toHaveAttribute('data-state', 'active');
  });

  it('keeps a mode once picked, rather than clearing it when it is picked again', () => {
    show();
    showMode('Preview');
    showMode('Preview');
    expect(modeTab('Preview')).toHaveAttribute('data-state', 'active');
  });

  it('switches the view from a bar over the pane, the way the prompt editors do', () => {
    show();
    // Full width and two across: the same shape as an editor's Edit | Preview bar, in the same place.
    const bar = modeTab('Chips').closest('[role="tablist"]')!;
    expect(bar.className).toContain('w-full');
    expect(bar.className).toContain('grid-cols-2');
    // And a real panel behind each trigger, so nothing points at an id that is not there.
    for (const label of ['Chips', 'Preview'] as const) {
      const panel = modeTab(label).getAttribute('aria-controls');
      expect(document.getElementById(panel!)).not.toBeNull();
    }
  });

  it('draws every settings-allowed condition without being asked', () => {
    // With the toggles gone the hub shows the playthrough at its fullest: the recap band, the recall
    // pull, and the bracket rider all present when the settings allow them.
    show({ thinkingMode: 'off' });
    for (const label of [SOURCE_LABELS.recap, SOURCE_LABELS.recall, SOURCE_LABELS.direction]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('still drops what the settings rule out', () => {
    show({ memoryDigests: false });
    expect(screen.queryByText(SOURCE_LABELS.recap)).toBeNull();
    expect(screen.queryByText(SOURCE_LABELS.recall)).toBeNull();
  });

  it('offers fullscreen only when the caller wired it', () => {
    show();
    expect(screen.queryByRole('button', { name: 'View full screen' })).toBeNull();
    cleanup();
    const onFs = vi.fn();
    render(
      <RequestAnatomyPanel
        tab="narration" prompts={PROMPTS} values={VALUES} settings={SETTINGS}
        mode="chips" onModeChange={() => {}}
        onJump={() => {}} fullscreen={false} onRequestFullscreen={onFs}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'View full screen' }));
    expect(onFs).toHaveBeenCalled();
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
    expect(screen.getAllByText(CONTEXT_LABELS['turn-plan']).length).toBeGreaterThan(0);
  });

  it('shows the whole resolved request in Preview, with nothing cut short', () => {
    show({ thinkingMode: 'off' });
    showMode('Preview');
    const shown = document.body.textContent ?? '';
    // The fixture's own turns ride the history in full — no excerpt cuts one short.
    expect(shown).toContain('and inside it, a map with Harrow');
    expect(shown).not.toContain('…');
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

describe('RequestAnatomyPanel scroll parity', () => {
  afterEach(() => vi.restoreAllMocks());

  /** The runs each view lays out, which is what the two are scrolled together by. */
  const runsIn = (root: HTMLElement) => root.querySelectorAll(`[${ANATOMY_RUN_ATTR}]`).length;

  it('draws one anchor per run in both views, so a position in one exists in the other', () => {
    show();
    const chips = runsIn(document.body);
    expect(chips).toBeGreaterThan(0);
    showMode('Preview');
    // Same count, so an anchor captured against the nth run resolves to the nth run in the other view.
    expect(runsIn(document.body)).toBe(chips);
  });

  // Where the flip actually *lands* is not assertable here: jsdom measures every box at zero, so every run
  // top collapses to the same position and any interpolation resolves to the top whether the panel applied
  // the anchor or ignored it. Faking rects would only test the fake. That half is checked in the browser.

  it('starts a different prompt at its own top rather than where the last one was left', () => {
    scrollablePanes({ scrollHeight: 2000, clientHeight: 400 });
    const { rerender } = show();
    const scroller = viewport();
    scroller.scrollTop = 800;
    fireEvent.scroll(scroller);
    // The hub stays mounted when the rail selects another prompt, so the pane keeps whatever scroll it had.
    rerender(<Harness tab="choices" settings={SETTINGS} onJump={() => {}} />);
    expect(viewport().scrollTop).toBe(0);
  });
});

describe('RequestAnatomyPanel full screen', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it('offers no split in place, however wide the panel is', () => {
    atWidth(1600);
    show();
    // In place the panel is one column of a modal that has a rail beside it, so it stays on one view.
    expect(modeTab('Chips')).toHaveAttribute('data-state', 'active');
    expect(screen.queryByText(/A quiet stretch of coast/)).toBeNull();
    expect(screen.queryByRole('button', { name: /side by side|one view at a time/ })).toBeNull();
  });

  it('shows both views side by side at full screen, with nothing left to pick between', () => {
    showFullscreen(1600);
    // Two panes, so both a chip and the resolved text it stands for are on screen at once.
    expect(screen.getAllByText('World').length).toBeGreaterThan(0);
    expect(screen.getByText(/A quiet stretch of coast/)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Chips' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show one view at a time' })).toBeInTheDocument();
  });

  it('falls back to one pane when full screen is too narrow for two readable ones', () => {
    showFullscreen(600);
    expect(modeTab('Chips')).toHaveAttribute('data-state', 'active');
    expect(screen.queryByRole('button', { name: /side by side/ })).toBeNull();
    expect(screen.queryByText(/A quiet stretch of coast/)).toBeNull();
  });

  it('lets the split be pinned off, and the view bar comes back with it', () => {
    showFullscreen(1600);
    fireEvent.click(screen.getByRole('button', { name: 'Show one view at a time' }));
    expect(modeTab('Chips')).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('button', { name: 'Show chips and preview side by side' })).toBeInTheDocument();
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

  it('leaves an assembled block nobody wrote inert — there is nothing to open', () => {
    show({ thinkingMode: 'off' }, 'narration');
    expect(screen.getAllByText(CONTEXT_LABELS['past-action'])[0].closest('button')).toBeNull();
  });

  it('makes a template chip a way into its own placement in the editor', () => {
    const onJump = vi.fn();
    show({ thinkingMode: 'off' }, 'choices', onJump);
    const chip = screen.getAllByRole('button').find((b) => b.title === 'Show this chip in the System Prompt')!;
    fireEvent.click(chip);
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ tab: 'choices', surface: 'system' }));
    expect(onJump.mock.calls[0][0].chip).toMatch(/^<.+>$/);
  });

  it('makes an assembled block a way into the anatomy of the prompt that wrote it', () => {
    const onJump = vi.fn();
    show({ thinkingMode: 'precall' }, 'narration', onJump);
    fireEvent.click(screen.getAllByText(CONTEXT_LABELS['turn-plan'])[0].closest('button')!);
    expect(onJump).toHaveBeenCalledWith({ tab: 'thinking' });
  });
});
