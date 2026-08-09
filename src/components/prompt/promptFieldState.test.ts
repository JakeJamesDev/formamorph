import { describe, it, expect } from 'vitest';
import { createEditor, $getRoot, $isElementNode, $createRangeSelection, $setSelection, type ElementNode } from 'lexical';
import { VariableNode } from './VariableNode';
import { buildEditorState, serializeRoot, pointAtOffset, $applyMarkdownAction } from './promptFieldState';
import { plainVocabulary, placeholderVocabulary, promptVocabulary } from '@/lib/chipVocabulary';
import { joinToken } from '@/lib/promptVariables';
import { defaultSystemPrompt, defaultNowLinePrompt } from '@/components/game/GamePrompts';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { Placeholder } from '@/types';

// The markdown toolbar maps a Lexical selection onto offsets in the flat token-string, runs the pure
// transform, then maps the result back. A chip is one node but many characters, so that mapping is where
// this can silently go wrong — these drive it through a real (headless) editor.

const PLACEHOLDERS: Placeholder[] = [{ id: 'p1', name: 'threat', values: ['the Demon King'] }];
const TOKEN = encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'x' });

function makeEditor() {
  return createEditor({ nodes: [VariableNode], onError: (e) => { throw e; } });
}

/** Seed the editor with `value`, select the flat-offset range, run `action`, return the new flat value. */
function runAction(value: string, start: number, end: number, action: Parameters<typeof $applyMarkdownAction>[1], withChips = false) {
  const editor = makeEditor();
  const parse = withChips ? placeholderVocabulary(PLACEHOLDERS).parse : plainVocabulary().parse;
  let result = '';
  editor.update(() => { buildEditorState(value, parse); }, { discrete: true });
  editor.update(() => {
    const para = $getRoot().getFirstChild();
    if (!$isElementNode(para)) throw new Error('no paragraph');
    const from = pointAtOffset(para as ElementNode, start);
    const to = pointAtOffset(para as ElementNode, end);
    const sel = $createRangeSelection();
    sel.anchor.set(from.key, from.offset, from.type);
    sel.focus.set(to.key, to.offset, to.type);
    $setSelection(sel);
    $applyMarkdownAction(parse, action);
  }, { discrete: true });
  editor.getEditorState().read(() => { result = serializeRoot(); });
  return result;
}

describe('promptFieldState', () => {
  describe('round-trips the flat value', () => {
    it.each([
      ['plain text', 'brave hero', false],
      ['multi-line text', 'line one\nline two', false],
      // Narration is markdown prose, where the blank line between paragraphs is what separates them: lose
      // it and the whole turn re-renders as one block.
      ['markdown paragraphs', 'The dock creaks.\n\nMarrow turns.\n\n> "You came."\n\n- one\n- two', false],
      ['a trailing blank line', 'The dock creaks.\n\n', false],
      ['text around a chip', `before ${TOKEN} after`, true],
      ['a chip alone', TOKEN, true],
      ['empty', '', false],
    ])('%s', (_label, value, withChips) => {
      const editor = makeEditor();
      const parse = withChips ? placeholderVocabulary(PLACEHOLDERS).parse : plainVocabulary().parse;
      let out = '';
      editor.update(() => { buildEditorState(value as string, parse); }, { discrete: true });
      editor.getEditorState().read(() => { out = serializeRoot(); });
      expect(out).toBe(value);
    });
  });

  describe('$applyMarkdownAction', () => {
    it('wraps the selected text in bold', () => {
      expect(runAction('brave hero', 0, 5, 'bold')).toBe('**brave** hero');
    });

    it('prefixes the line for a block action', () => {
      expect(runAction('a title', 0, 0, 'h2')).toBe('## a title');
    });

    it('wraps a placeholder chip itself when it is selected', () => {
      expect(runAction(TOKEN, 0, TOKEN.length, 'bold', true)).toBe(`**${TOKEN}**`);
    });

    it('counts a chip as its whole token when text after it is selected', () => {
      // "brave" starts right after the chip + one space. If the chip were counted as a single character,
      // the markers would land inside the token and corrupt it.
      const value = `${TOKEN} brave hero`;
      const start = TOKEN.length + 1;
      expect(runAction(value, start, start + 5, 'bold', true)).toBe(`${TOKEN} **brave** hero`);
    });

    it('leaves a chip intact when prefixing the line it sits on', () => {
      expect(runAction(`${TOKEN} rises`, 0, 0, 'quote', true)).toBe(`> ${TOKEN} rises`);
    });

    it('inserts a placeholder for an empty selection', () => {
      expect(runAction('', 0, 0, 'bold')).toBe('**bold text**');
    });
  });

  describe('plainVocabulary', () => {
    it('keeps a placeholder token as inert text rather than a chip', () => {
      // The world description renders before any roll exists, so a token there must never become a chip.
      expect(plainVocabulary().parse(`a ${TOKEN} b`)).toEqual([{ type: 'text', value: `a ${TOKEN} b` }]);
    });
  });
});

describe('chip affixes survive the editor round-trip', () => {
  /** Seed the editor from a flat string and read it straight back — the path taken every time the
   *  settings panel opens and closes. Any drift here silently rewrites a stored prompt. */
  const roundTrip = (value: string): string => {
    const editor = makeEditor();
    const parse = promptVocabulary([]).parse;
    let out = '';
    editor.update(() => { buildEditorState(value, parse); }, { discrete: true });
    editor.getEditorState().read(() => { out = serializeRoot(); });
    return out;
  };

  it('returns an affixed prompt byte-identically', () => {
    const affixed = joinToken({ base: '<ENTITIES>', variantId: 'name', pre: ' with ', post: ' present' });
    const value = `Now you are at <LOCATION|name>${affixed}; the scene is underway.`;
    expect(roundTrip(value)).toBe(value);
  });

  it('preserves affixes containing the characters the quoting protects', () => {
    for (const pre of [' > ', ' | ', ', inside ', "the player's own: "]) {
      const value = `lead ${joinToken({ base: '<NOTES>', pre })} tail`;
      expect(roundTrip(value)).toBe(value);
    }
  });

  it('returns the shipped prompts unchanged', () => {
    for (const p of [defaultSystemPrompt, defaultNowLinePrompt]) expect(roundTrip(p)).toBe(p);
  });

  it('leaves a malformed affix as literal text rather than eating it', () => {
    const value = '<LOCATION|name|pre=unquoted> tail';
    expect(roundTrip(value)).toBe(value);
  });
});
