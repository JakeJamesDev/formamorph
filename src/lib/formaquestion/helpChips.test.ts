import { describe, expect, it } from 'vitest';
import { DOCS_LOOKUP } from './docsLookup';
import { GENERAL_KNOWLEDGE_MARKER } from './generalKnowledge';
import { sentenceShapeViolation } from '@/test/copyShape';
import { HELP_CHIP, HELP_CHIPS, helpChipVocabulary, parseHelpPrompt, renderHelpPrompt } from './helpChips';
import { HELP_PICK_LIMIT } from './helpPicks';
import { DEFAULT_HELP_PROMPTS, HELP_LOOKUP_SYSTEM_PROMPT, HELP_PICK_SYSTEM_PROMPT, HELP_PROMPT_CHIPS, HELP_SYSTEM_PROMPT } from './helpPrompt';

/** The prompts as the help session sent them before the chips, byte for byte. The Default preset must send these. */
const SENT_BEFORE = {
  answer: [
    'You are the help writer for Formamorph, a text adventure app. A player asks how to use the app, and you answer from the guide sections in the message.',
    '',
    '- Take each fact, each step and each name from the guide sections.',
    '- When the player asks how to do a task, answer with every step of that task as a numbered list, in the order the guide gives.',
    '- Write each control name as the guide writes it, in bold.',
    '- After the steps, add one or two sentences of detail when the player needs them.',
    '- When the guide sections do not cover the question, write [NOT IN GUIDE] alone on the first line. Then answer from general knowledge in a few sentences, and name only the controls the guide names.',
  ].join('\n'),
  pick: [
    'You are the librarian of the Formamorph player guide. Formamorph is a text adventure app. A player asks a question, and you pick the guide sections that answer it.',
    '',
    'The message lists every section of the guide, one on each line: the page, then the headings down to the section.',
    '',
    '- Pick the sections whose text answers the question, the best one first.',
    '- Pick 5 sections at most.',
    '- Reply with the lines of your picks alone, one on each line, each copied as the list writes it.',
  ].join('\n'),
  lookup: [
    'You are the help writer for Formamorph, a text adventure app. A player asks how to use the app, and you answer from the guide.',
    '',
    '- The message holds the guide sections that match the words of the question. Find and read each other section the question needs with read_guide.',
    '- Take each fact, each step and each name from the guide sections you read.',
    '- When the player asks how to do a task, answer with every step of that task as a numbered list, in the order the guide gives.',
    '- Write each control name as the guide writes it, in bold.',
    '- After the steps, add one or two sentences of detail when the player needs them.',
    '- When the guide sections do not cover the question, write [NOT IN GUIDE] alone on the first line. Then answer from general knowledge in a few sentences, and name only the controls the guide names.',
  ].join('\n'),
};

/** The lines the Voice chip sends for the Voice "Be warm.". */
const FRAMED_WARM = [
  'Speak in this voice: Be warm.',
  'Keep that voice. Start with the answer, and write each step and control name as the guide writes it.',
];

describe('the default help prompts', () => {
  it('render to the texts the help session sent before they had chips', () => {
    expect(HELP_SYSTEM_PROMPT).toBe(SENT_BEFORE.answer);
    expect(HELP_PICK_SYSTEM_PROMPT).toBe(SENT_BEFORE.pick);
    expect(HELP_LOOKUP_SYSTEM_PROMPT).toBe(SENT_BEFORE.lookup);
  });

  it('send the Voice as the paragraph after the intro line of both answer prompts', () => {
    const voice = { voice: 'Be warm.' };
    expect(renderHelpPrompt(DEFAULT_HELP_PROMPTS.answer, voice)).toBe([
      'You are the help writer for Formamorph, a text adventure app. A player asks how to use the app, and you answer from the guide sections in the message.',
      '',
      ...FRAMED_WARM,
      '',
      SENT_BEFORE.answer.split('\n\n')[1],
    ].join('\n'));
    expect(renderHelpPrompt(DEFAULT_HELP_PROMPTS.lookup, voice)).toBe([
      'You are the help writer for Formamorph, a text adventure app. A player asks how to use the app, and you answer from the guide.',
      '',
      ...FRAMED_WARM,
      '',
      SENT_BEFORE.lookup.split('\n\n')[1],
    ].join('\n'));
    expect(renderHelpPrompt(DEFAULT_HELP_PROMPTS.pick, voice)).toBe(SENT_BEFORE.pick);
  });

  it('place each chip their request reads back, and no other', () => {
    for (const [key, chips] of Object.entries(HELP_PROMPT_CHIPS) as [keyof typeof HELP_PROMPT_CHIPS, readonly string[]][]) {
      const placed = parseHelpPrompt(DEFAULT_HELP_PROMPTS[key]).flatMap((segment) => (segment.type === 'variable' ? [segment.token] : []));
      expect(new Set(placed), key).toEqual(new Set(chips));
    }
  });
});

describe('a help chip', () => {
  it('renders to the text the constant holds', () => {
    expect(renderHelpPrompt(`Write ${HELP_CHIP.marker} first.`)).toBe(`Write ${GENERAL_KNOWLEDGE_MARKER} first.`);
    expect(renderHelpPrompt(`Call ${HELP_CHIP.lookupFunction}.`)).toBe(`Call ${DOCS_LOOKUP.name}.`);
    expect(renderHelpPrompt(`Pick ${HELP_CHIP.pickLimit} at most.`)).toBe(`Pick ${HELP_PICK_LIMIT} at most.`);
    expect(renderHelpPrompt(HELP_CHIP.replyFormat)).toBe('- Reply with the lines of your picks alone, one on each line, each copied as the list writes it.');
  });

  it('sends the Voice that comes with the question in its frame, in place', () => {
    expect(renderHelpPrompt(`Intro.\n\n${HELP_CHIP.voice}\n\n- Rule.`, { voice: 'Be warm.' })).toBe(['Intro.', '', ...FRAMED_WARM, '', '- Rule.'].join('\n'));
    expect(renderHelpPrompt(`Intro. ${HELP_CHIP.voice} Rule.`, { voice: 'Be warm.' })).toBe(`Intro. ${FRAMED_WARM.join('\n')} Rule.`);
  });

  it('leaves no blank line where an empty Voice stands alone on its line', () => {
    const empty = { voice: '' };
    expect(renderHelpPrompt(`Intro.\n\n${HELP_CHIP.voice}\n\n- Rule.`, empty)).toBe('Intro.\n\n- Rule.');
    expect(renderHelpPrompt(`Intro.\n${HELP_CHIP.voice}\n- Rule.`, empty)).toBe('Intro.\n- Rule.');
    expect(renderHelpPrompt(`  ${HELP_CHIP.voice} \n\nIntro.`, empty)).toBe('Intro.');
    expect(renderHelpPrompt(`Intro.\n\n${HELP_CHIP.voice}`, empty)).toBe('Intro.');
    expect(renderHelpPrompt(HELP_CHIP.voice, empty)).toBe('');
    expect(renderHelpPrompt(`Intro. ${HELP_CHIP.voice}`, empty)).toBe('Intro. ');
  });

  it('sends no Voice when the question brings none', () => {
    expect(renderHelpPrompt(`Intro.\n\n${HELP_CHIP.voice}\n\n- Rule.`)).toBe('Intro.\n\n- Rule.');
  });

  it('is the only way a prompt sends its text: a prompt with no chip sends none of it', () => {
    const plain = 'Answer from the guide. Say when it does not cover the question.';
    expect(renderHelpPrompt(plain)).toBe(plain);
    expect(renderHelpPrompt(plain)).not.toContain(GENERAL_KNOWLEDGE_MARKER);
  });

  it('carries a hint written as one short help line', () => {
    for (const { hint } of Object.values(HELP_CHIPS)) {
      expect(sentenceShapeViolation(hint), hint).toBeNull();
      expect(hint).not.toMatch(/^The /);
    }
  });

  it('is a chip only as its exact token; any other angle-bracket text stays text', () => {
    expect(parseHelpPrompt('Use <guide> tags and <NOT_IN_GUIDE_2>.')).toEqual([{ type: 'text', value: 'Use <guide> tags and <NOT_IN_GUIDE_2>.' }]);
    expect(parseHelpPrompt(`a${HELP_CHIP.marker}b`)).toEqual([
      { type: 'text', value: 'a' }, { type: 'variable', token: HELP_CHIP.marker }, { type: 'text', value: 'b' },
    ]);
    expect(renderHelpPrompt('<NOTES> stays as typed')).toBe('<NOTES> stays as typed');
  });
});

describe('the help chip vocabulary of a prompt', () => {
  const vocabulary = helpChipVocabulary(HELP_PROMPT_CHIPS.pick);

  it('knows every help chip, labels it, and offers only the chips of its prompt', () => {
    expect(vocabulary.isKnown(HELP_CHIP.marker)).toBe(true);
    expect(vocabulary.isKnown('<NOTES>')).toBe(false);
    expect(vocabulary.label(HELP_CHIP.pickLimit)).toBe('Search Limit');
    expect(vocabulary.hint?.(HELP_CHIP.pickLimit)).toBe(HELP_CHIPS[HELP_CHIP.pickLimit].hint);
    expect(vocabulary.palette().map((row) => row.token)).toEqual([HELP_CHIP.pickLimit, HELP_CHIP.replyFormat]);
    expect(vocabulary.acceptsPaletteToken?.(HELP_CHIP.replyFormat)).toBe(true);
    expect(vocabulary.acceptsPaletteToken?.(HELP_CHIP.marker)).toBe(false);
  });

  it('parses with the help grammar, so the editor draws the chips the request renders', () => {
    expect(vocabulary.parse(DEFAULT_HELP_PROMPTS.pick).filter((segment) => segment.type === 'variable')).toHaveLength(2);
  });
});
