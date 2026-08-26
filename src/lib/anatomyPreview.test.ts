import { describe, it, expect } from 'vitest';
import {
  buildAnatomyHub, anatomyToggleAvailability,
  type AnatomyConditions, type AnatomyPreviewPrompts, type AnatomyPreviewSettings,
} from './anatomyPreview';
import { runsTile, type AnatomyBlock } from './requestAnatomy';
import { composePreviewValues } from './previewValuePool';
import { PARITY_PROMPTS } from './turnPipeline/parityTestInputs';
import { allGroupedTabs } from './promptGroups';
import type { ThinkingMode } from '@/contexts/SettingsContext';
import {
  defaultSystemPrompt, defaultNarrationUserPrompt, defaultRecapUserPrompt,
  defaultNowLinePrompt, defaultRehydrateUserPrompt, defaultOocDirectivePrompt,
  INLINE_THINKING_DIRECTIVE,
} from '@/components/game/GamePrompts';

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

const valuesFor = (s: AnatomyPreviewSettings) => composePreviewValues({
  paragraphLimit: s.paragraphLimit, maxTokens: s.maxTokens, markdownOutput: s.markdownOutput,
  sectionStyle: s.sectionStyle, limitActiveCharacters: false, activeCharacterLimit: 3, language: s.language,
});

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

const ALL_ON: AnatomyConditions = { recap: true, recall: true, brackets: true };

/** One hub under a settings/condition combination, with the chip pool composed from the same settings. */
const hub = (
  tab: string,
  over: Partial<AnatomyConditions> = {},
  prompts = PROMPTS,
  settingsOver: Partial<AnatomyPreviewSettings> = {},
) => {
  const settings = { ...SETTINGS, ...settingsOver };
  return buildAnatomyHub(tab, prompts, valuesFor(settings), { ...ALL_ON, ...over }, settings);
};

/** The narration hub's single request, which most of this suite is about. */
const preview = (
  over: Partial<AnatomyConditions> = {},
  prompts = PROMPTS,
  settingsOver: Partial<AnatomyPreviewSettings> = {},
) => hub('narration', over, prompts, settingsOver)[0].blocks;

/** Every label present anywhere in a preview, authored and context alike. */
const labels = (blocks: AnatomyBlock[]) =>
  blocks.flatMap((b) => b.runs.map((r) => r.source ?? r.contextLabel));

/** The text one source's run actually selects, across every block. */
const textOf = (blocks: AnatomyBlock[], source: string) =>
  blocks.flatMap((b) => b.runs.filter((r) => r.source === source).map((r) => b.content.slice(r.start, r.end)));

/** The text one context label's run actually selects, across every block. */
const contextTextOf = (blocks: AnatomyBlock[], label: string) =>
  blocks.flatMap((b) => b.runs.filter((r) => r.contextLabel === label).map((r) => b.content.slice(r.start, r.end)));

const MODES: ThinkingMode[] = ['off', 'precall', 'inline', 'staged'];

describe('the narration hub', () => {
  it('opens with the system message and continues as an alternating conversation', () => {
    const blocks = preview();
    expect(blocks[0].role).toBe('system');
    expect(blocks.slice(1).map((b) => b.role)).toEqual(
      blocks.slice(1).map((_, i) => (i % 2 === 0 ? 'user' : 'assistant')),
    );
    expect(blocks[blocks.length - 1].role).toBe('user');
  });

  it('tiles every block exactly, under every combination of conditions and every mode', () => {
    for (const thinkingMode of MODES) {
      for (const recap of [true, false]) {
        for (const recall of [true, false]) {
          for (const brackets of [true, false]) {
            const blocks = preview({ recap, recall, brackets }, PROMPTS, { thinkingMode });
            blocks.forEach((b) => expect(runsTile(b.content, b.runs)).toBe(true));
          }
        }
      }
    }
  });

  it('tiles every block exactly under every settings combination the toggles do not cover', () => {
    for (const sectionStyle of ['markdown', 'labels', 'xml'] as const) {
      for (const markdownOutput of [true, false]) {
        for (const timeContext of [true, false]) {
          for (const language of ['English', 'French']) {
            const blocks = preview({}, PROMPTS, { sectionStyle, markdownOutput, timeContext, language });
            blocks.forEach((b) => expect(runsTile(b.content, b.runs)).toBe(true));
          }
        }
      }
    }
  });

  it('shows all six editor surfaces with every condition on', () => {
    expect(new Set(labels(preview()))).toEqual(
      new Set([
        'system-template', 'user-template', 'recap', 'now', 'recall', 'direction',
        'world-data', 'condensed', 'recalled', 'past-action', 'past-narration', 'action',
      ]),
    );
  });

  it('shows the player their own text, not a paraphrase of it', () => {
    const blocks = preview();
    expect(textOf(blocks, 'recap')).toEqual([defaultRecapUserPrompt]);
    expect(textOf(blocks, 'recall')).toEqual([defaultRehydrateUserPrompt]);
    expect(textOf(blocks, 'direction')).toEqual([defaultOocDirectivePrompt]);
    // The now-line is a template, so what lands is its render against this world's values.
    expect(textOf(blocks, 'now')).toEqual([expect.stringContaining('Now you are at')]);
    expect(textOf(blocks, 'system-template').join('')).toContain('You are the narrator stage');
  });

  it('follows an edit to a message through into the request', () => {
    const edited = { ...PROMPTS, recap: 'WHAT HAPPENED BEFORE THIS?' };
    expect(textOf(preview({}, edited), 'recap')).toEqual(['WHAT HAPPENED BEFORE THIS?']);
  });

  it('drops the recap exchange, and the now-line with it, when nothing is condensed', () => {
    const off = labels(preview({ recap: false }));
    expect(off).not.toContain('recap');
    expect(off).not.toContain('now');
    expect(off).not.toContain('condensed');
    // Every turn rides full instead, so nothing is lost — it is just not condensed.
    expect(off.filter((l) => l === 'past-narration')).toHaveLength(4);
  });

  it('drops both recall runs when Scene Recall did not fire', () => {
    const off = labels(preview({ recall: false }));
    expect(off).not.toContain('recall');
    expect(off).not.toContain('recalled');
    expect(labels(preview({ recall: true }))).toContain('recalled');
  });

  it('recalls a scene only from the condensed band, since that is where it is pulled from', () => {
    expect(labels(preview({ recap: false, recall: true }))).not.toContain('recalled');
  });

  it('separates the template the player typed from the action it wraps', () => {
    const blocks = preview({ brackets: false });
    const last = blocks[blocks.length - 1];
    const runs = last.runs.map((r) => [r.source ?? r.contextLabel, last.content.slice(r.start, r.end)]);
    expect(runs).toContainEqual(['action', 'I take the map and start down toward the causeway.']);
    expect(runs.some(([label]) => label === 'user-template')).toBe(true);
  });

  it('splits the system prompt into the author words and the world data its chips inject', () => {
    const system = preview()[0];
    const chipRuns = system.runs.filter((r) => r.contextLabel === 'world-data');
    expect(chipRuns.length).toBeGreaterThan(1);
    // A chip's run holds the injected value, never the token that asked for it.
    expect(chipRuns.map((r) => system.content.slice(r.start, r.end)).join('\n')).not.toContain('<WORLD DESCRIPTION>');
    expect(system.content).toContain('Sample Town');
  });

  it('is deterministic — the same inputs draw the same request every time', () => {
    expect(preview()).toEqual(preview());
  });
});

describe('the narration hub under the Thinking mode the player runs', () => {
  it('sends the user template and the direction rider only with thinking off', () => {
    for (const thinkingMode of MODES) {
      const has = labels(preview({}, PROMPTS, { thinkingMode }));
      const expected = thinkingMode === 'off';
      expect(has.includes('user-template')).toBe(expected);
      expect(has.includes('direction')).toBe(expected);
    }
  });

  it('shows the inline mode its own directive, and no other mode that directive', () => {
    const inline = preview({}, PROMPTS, { thinkingMode: 'inline' });
    expect(contextTextOf(inline, 'mode-directive')).toEqual([INLINE_THINKING_DIRECTIVE]);
    for (const thinkingMode of ['off', 'precall', 'staged'] as const) {
      expect(labels(preview({}, PROMPTS, { thinkingMode }))).not.toContain('mode-directive');
    }
  });

  it('shows the planning modes the turn plan they hand the narration', () => {
    for (const thinkingMode of ['precall', 'staged'] as const) {
      const plan = contextTextOf(preview({}, PROMPTS, { thinkingMode }), 'turn-plan');
      expect(plan).toHaveLength(1);
      expect(plan[0]).toContain('Rough notes on what happens this turn');
      expect(plan[0]).toContain('causeway');
    }
    for (const thinkingMode of ['off', 'inline'] as const) {
      expect(labels(preview({}, PROMPTS, { thinkingMode }))).not.toContain('turn-plan');
    }
  });

  it('rides the bracket on the action in every mode, answered by the Direction rider only in off', () => {
    for (const thinkingMode of MODES) {
      const blocks = preview({ brackets: true }, PROMPTS, { thinkingMode });
      const action = contextTextOf(blocks, 'action').join('');
      expect(action).toContain('[keep the tide going out through this scene]');
      expect(labels(blocks).includes('direction')).toBe(thinkingMode === 'off');
      expect(contextTextOf(preview({ brackets: false }, PROMPTS, { thinkingMode }), 'action').join(''))
        .not.toContain('[keep the tide');
    }
  });
});

describe('the narration hub under the output settings the player chose', () => {
  const systemText = (over: Partial<AnatomyPreviewSettings>) => preview({}, PROMPTS, over)[0].content;

  it('renders the system prompt in the section style the player picked', () => {
    expect(systemText({ sectionStyle: 'markdown' })).toContain('## Formatting');
    expect(systemText({ sectionStyle: 'xml' })).toContain('<formatting>');
    expect(systemText({ sectionStyle: 'xml' })).not.toContain('## Formatting');
    expect(systemText({ sectionStyle: 'labels' })).toContain('FORMATTING:');
  });

  it('reflects the markdown-output setting', () => {
    expect(systemText({ markdownOutput: true })).toContain('Use Markdown emphasis with intent');
    const off = systemText({ markdownOutput: false });
    expect(off).toContain('Write plain prose');
    expect(off).not.toContain('Use Markdown emphasis with intent');
  });

  it('reflects the paragraph limit and the reply cap it is sized against', () => {
    expect(systemText({ paragraphLimit: 'single' })).toContain('Write a single paragraph.');
    expect(systemText({ paragraphLimit: 'auto', maxTokens: 800 })).toMatch(/Write at most \d+ short paragraphs\./);
    expect(systemText({ paragraphLimit: 'auto', maxTokens: 800 }))
      .not.toEqual(systemText({ paragraphLimit: 'auto', maxTokens: 200 }));
    expect(systemText({ paragraphLimit: 'none' })).not.toContain('short paragraphs');
  });

  it('reflects the AI Language setting', () => {
    expect(systemText({ language: 'French' })).toContain('French');
    expect(systemText({ language: 'English' })).not.toContain('French');
  });
});

describe('the narration hub under the memory settings the player chose', () => {
  it('leaves no recap trace with Memory Summaries off, even with the toggle forced on', () => {
    const off = labels(preview({ recap: true }, PROMPTS, { memoryDigests: false }));
    for (const label of ['recap', 'now', 'condensed', 'recall', 'recalled']) {
      expect(off).not.toContain(label);
    }
    expect(off.filter((l) => l === 'past-narration')).toHaveLength(4);
  });

  it('leaves no recall trace with semantic rehydration off, even with the toggle forced on', () => {
    for (const over of [{ semanticMemory: false }, { semanticRehydration: false }]) {
      const off = labels(preview({ recall: true }, PROMPTS, over));
      expect(off).not.toContain('recall');
      expect(off).not.toContain('recalled');
      // The band itself is untouched — only the pull from it is gone.
      expect(off).toContain('condensed');
    }
  });

  it('stamps every condensed memory with its in-world time when the clock is riding along', () => {
    // Two digests band with Scene Recall pulling the third, and the fixture's own durations put them at
    // different points of the same day — so each carries its own stamp, not one repeated label.
    const stamped = contextTextOf(preview({}, PROMPTS, { timeContext: true }), 'condensed').join(' ');
    expect([...stamped.matchAll(/\[([^\]]+)\] \S/g)].map((m) => m[1])).toEqual([
      'Day 1, morning — earlier today',
      'Day 1, midday — earlier today',
    ]);
    // The digests themselves are untouched underneath the stamps.
    expect(stamped).toContain('The traveler asked Wren about');
  });

  it('leaves the band unstamped when the clock is not riding along', () => {
    const plain = contextTextOf(preview({}, PROMPTS, { timeContext: false }), 'condensed').join(' ');
    expect(plain).not.toMatch(/\[Day \d/);
    expect(plain).toContain('The traveler asked Wren about');
  });
});

describe('anatomyToggleAvailability', () => {
  it('offers the recap toggle only with Memory Summaries on', () => {
    expect(anatomyToggleAvailability({ ...SETTINGS, memoryDigests: true }).recap).toBe(true);
    expect(anatomyToggleAvailability({ ...SETTINGS, memoryDigests: false }).recap).toBe(false);
  });

  it('offers the recall toggle only where the Recall message itself is available', () => {
    expect(anatomyToggleAvailability(SETTINGS).recall).toBe(true);
    for (const off of [{ memoryDigests: false }, { semanticMemory: false }, { semanticRehydration: false }]) {
      expect(anatomyToggleAvailability({ ...SETTINGS, ...off }).recall).toBe(false);
    }
  });

  it('always offers the bracket toggle — the bracket rides the action in every mode', () => {
    for (const thinkingMode of MODES) {
      expect(anatomyToggleAvailability({ ...SETTINGS, thinkingMode }).brackets).toBe(true);
    }
  });

  it('agrees with what the builder will actually draw', () => {
    for (const memoryDigests of [true, false]) {
      for (const semanticRehydration of [true, false]) {
        const over = { memoryDigests, semanticRehydration };
        const available = anatomyToggleAvailability({ ...SETTINGS, ...over });
        const drawn = labels(preview(ALL_ON, PROMPTS, over));
        expect(drawn.includes('recap')).toBe(available.recap);
        expect(drawn.includes('recall')).toBe(available.recall);
      }
    }
  });
});

/** Which template each prompt's hub renders as its system prompt, so an edit to it can be traced through. */
const SYSTEM_TEMPLATE: Record<string, string> = {
  narration: 'system', thinking: 'thinking', director: 'director', character: 'character',
  storyboard: 'storyboard', choices: 'choices', statupdates: 'statUpdates',
  location: 'locationChange', summary: 'summary', diary: 'diary',
  timepassed: 'timePassed', timeopening: 'openingTime', scenetags: 'sceneTags',
};

/** The same prompts with one template swapped for a marker that still carries a chip, so both the authored
 *  run and the world data around it stay visible. */
const withMarker = (tab: string, marker: string): AnatomyPreviewPrompts => {
  const key = SYSTEM_TEMPLATE[tab];
  const value = `${marker} <WORLD DESCRIPTION>`;
  return key === 'system'
    ? { ...PROMPTS, system: value }
    : { ...PROMPTS, turn: { ...PROMPTS.turn, [key]: value } };
};

describe('every prompt in the rail has a hub', () => {
  const TABS = allGroupedTabs();

  it.each(TABS)('draws the request %s is part of', (tab) => {
    const requests = hub(tab);
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.blocks[0].role).toBe('system');
      expect(request.blocks.length).toBeGreaterThan(1);
    }
  });

  it.each(TABS)('tiles every block of %s exactly', (tab) => {
    for (const thinkingMode of MODES) {
      for (const request of hub(tab, {}, PROMPTS, { thinkingMode })) {
        request.blocks.forEach((b) => expect(runsTile(b.content, b.runs)).toBe(true));
      }
    }
  });

  it.each(TABS)('shows the player their own text in %s, not a paraphrase of it', (tab) => {
    const marked = hub(tab, {}, withMarker(tab, 'MY OWN WORDS'));
    expect(textOf(marked[0].blocks, 'system-template').join('')).toContain('MY OWN WORDS');
    // The chip beside it still renders its value rather than the token that asked for it.
    expect(contextTextOf(marked[0].blocks, 'world-data').join('')).not.toContain('<WORLD DESCRIPTION>');
  });

  it.each(TABS)('names the request kind %s belongs to', (tab) => {
    for (const request of hub(tab)) expect(request.type).toBeTruthy();
  });
});

describe('the location hub follows the detection mode', () => {
  // The shipped template asks only about the action, so a narration chip is added here: the two modes
  // send the router at different points of the turn, and this is what that difference looks like.
  const asking = {
    ...PROMPTS,
    turn: { ...PROMPTS.turn, locationChangeUser: 'Action: <PLAYER ACTION>\nStory: <NARRATION>' },
  };
  const narrationIn = (tab: string, locationAutoApply: boolean) => {
    const requests = hub(tab, {}, asking, { locationAutoApply });
    return {
      keys: requests.map((r) => r.key),
      narration: requests[0].blocks.some((b) => b.runs.some((r) => r.contextLabel === 'narration')),
    };
  };

  it('draws only the pre-narration request when the mode resolves the move up front', () => {
    const { keys, narration } = narrationIn('location', true);
    expect(keys).toEqual(['locationAuto']);
    // It runs before the story is written, so the narration chip has nothing to fill it with.
    expect(narration).toBe(false);
  });

  it('draws only the post-narration request when the mode offers the move instead', () => {
    const { keys, narration } = narrationIn('location', false);
    expect(keys).toEqual(['locationSuggest']);
    expect(narration).toBe(true);
  });
});

describe('the fan-out hubs', () => {
  it('draws one example subject and says so, rather than repeating the cast', () => {
    for (const tab of ['character', 'diary']) {
      const requests = hub(tab);
      expect(requests).toHaveLength(1);
      expect(requests[0].caption).toContain('per character');
      expect(requests[0].caption).toContain('Wren');
      expect(requests[0].blocks.map((b) => b.content).join('')).toContain('Wren');
    }
  });
});
