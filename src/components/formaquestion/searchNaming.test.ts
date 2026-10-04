import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELP_CHIP, HELP_CHIPS } from '@/lib/formaquestion/helpChips';
import { AI_CONTEXT_COPY, ENDPOINT_COPY, GENERAL_COPY, PROMPTS_COPY } from './formaquestionSettingsTabs';

/** Q49: the request where the AI chooses guide sections is Search to the player. */
const OLD_NAME = /\bpick/i;

const read = (path: string): string => readFileSync(resolve(__dirname, path), 'utf8');

/** Every string a copy object holds, depth first. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('the Search request name', () => {
  it('shows in every settings string that names the request', () => {
    const named = {
      'General: AI Search row': GENERAL_COPY.aiPicks,
      'General: Keyword Search row': GENERAL_COPY.keyword,
      'General: Semantic Search row': GENERAL_COPY.semantic,
      'AI Context: request sources': AI_CONTEXT_COPY.sources,
      'Endpoint: Search Endpoint': ENDPOINT_COPY.pick,
      'Prompts: Search prompt': PROMPTS_COPY.prompts.pick,
      'Prompts: Search options': PROMPTS_COPY.options.prompts.pick,
      'Prompt chips: Search Limit': HELP_CHIPS[HELP_CHIP.pickLimit],
      'Prompt chips: Reply Format': HELP_CHIPS[HELP_CHIP.replyFormat],
    };
    for (const [where, copy] of Object.entries(named)) {
      // The chip's `text` is the prompt's own wording, so only its label and hint count.
      const shown = 'label' in copy && 'text' in copy ? [copy.label, copy.hint] : strings(copy);
      for (const line of shown) expect(line, where).not.toMatch(OLD_NAME);
    }
  });

  it('names the General switch, the Endpoint route and the prompt Search', () => {
    expect(GENERAL_COPY.aiPicks.label).toBe('AI Search');
    expect(AI_CONTEXT_COPY.sources.aiPicks).toBe('AI Search');
    expect(ENDPOINT_COPY.pick.label).toBe('Search Endpoint');
    expect(PROMPTS_COPY.prompts.pick.label).toBe('Search');
  });

  it('shows in the wait line, the trace and the guide', () => {
    const waitLines = read('AskParts.tsx');
    expect(waitLines).not.toMatch(/Picking sections/);
    expect(waitLines).toMatch(/picking: 'Searching with your AI…'/);
    const trace = read('../../lib/formaquestion/helpSession.ts');
    expect(trace).not.toMatch(/AI Picks/);
    expect(trace).toMatch(/requestTrace\('AI Search'/);
    const guide = ['Formaquestion', 'Glossary', 'Changelog'].map((page) => read(`../../../docs/${page}.md`)).join('\n');
    expect(guide).not.toMatch(/AI Picks|Pick Endpoint|Pick Limit|Picking sections|\*\*Picks\*\*|Scrim Opacity/);
  });
});

describe('the Backdrop setting', () => {
  it('has the Q48 label and hint', () => {
    expect(GENERAL_COPY.scrimOpacity).toEqual({ label: 'Backdrop', hint: 'Shades the screen behind the chat so the text stands out' });
  });
});

describe('the Q50 lines', () => {
  it('are each 12 words or fewer', () => {
    expect(GENERAL_COPY.keyword.hint).toBe('Matches the words in your question to guide sections');
    expect(GENERAL_COPY.aiPicks.hint).toBe('Asks your AI to choose the sections before answering. One extra request.');
    expect(GENERAL_COPY.semantic.hint).toBe('Finds sections by meaning, not exact words. Downloads a small model once.');
    expect(ENDPOINT_COPY.pick.description).toBe('Runs the search request. A small, fast model is enough.');
    for (const line of [GENERAL_COPY.keyword.hint, GENERAL_COPY.aiPicks.hint, GENERAL_COPY.semantic.hint, ENDPOINT_COPY.pick.description]) {
      expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(12);
    }
  });
});
