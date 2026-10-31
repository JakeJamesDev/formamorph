import { describe, expect, it } from 'vitest';
import { closedFences, readFitGrade, schemaAsBlocks, scoreCreateReply, scoreRefusal } from './help-create-score';

const block = (body: string, language = 'entity') => `\`\`\`${language}\n${body}\n\`\`\``;
const GOOD = block('Name: Wren\nAI Description: A squire who polishes armor at night.');
const LONG = block('Name: Tal\nAI Description: One. Two. Three. Four. Five.');

describe('closedFences', () => {
  it('reads each closed fence with its language and leaves an open one out', () => {
    expect(closedFences(`Hi!\n\n${GOOD}\n\n\`\`\`entity\nName: Half`)).toEqual([
      { language: 'entity', body: 'Name: Wren\nAI Description: A squire who polishes armor at night.' },
    ]);
  });

  it('keeps a shorter fence inside a longer one as text', () => {
    expect(closedFences('````md\n```entity\nName: X\n```\n````')).toEqual([{ language: 'md', body: '```entity\nName: X\n```' }]);
  });
});

describe('scoreCreateReply', () => {
  it('counts valid and invalid entity blocks with the app parser', () => {
    const score = scoreCreateReply(`Here you go!\n\n${GOOD}\n\n${LONG}`, 2);
    expect(score).toMatchObject({ blocks: 2, valid: 1, countMatch: true, strays: 0 });
    expect(score.drafts).toEqual([{ name: 'Wren', aiDescription: 'A squire who polishes armor at night.' }]);
    expect(score.problems).toEqual(['AI Description over 4 sentences']);
  });

  it('counts a draft in another fence language as a stray, not a block', () => {
    expect(scoreCreateReply(block('Name: Wren\nAI Description: A squire.', 'yaml'), 1)).toMatchObject({ blocks: 0, strays: 1, countMatch: false });
  });

  it('marks each valid draft whose name the world already uses', () => {
    const reply = `${GOOD}\n\n${block('Name: Tess\nAI Description: A reed cutter.')}`;
    expect(scoreCreateReply(reply, 2, ['Oren', ' tess ']).duplicates).toEqual([false, true]);
    expect(scoreCreateReply(reply, 2).duplicates).toEqual([false, false]);
  });

  it('marks a reply with fewer blocks than asked', () => {
    expect(scoreCreateReply(GOOD, 2).countMatch).toBe(false);
  });
});

describe('schemaAsBlocks', () => {
  it('turns the schema reply into blocks the parser reads', () => {
    const blocks = schemaAsBlocks('{"entities":[{"name":"Wren","aiDescription":"A squire."},{"name":"","aiDescription":"No name."}]}');
    expect(scoreCreateReply(blocks, 2)).toMatchObject({ blocks: 2, valid: 1 });
  });

  it('reads JSON inside a json fence', () => {
    expect(scoreCreateReply(schemaAsBlocks('```json\n{"entities":[{"name":"Wren","aiDescription":"A squire."}]}\n```'), 1).valid).toBe(1);
  });

  it('stands for no block when the reply is not the schema', () => {
    expect(schemaAsBlocks('Sure! Here is Wren.')).toBe('');
    expect(schemaAsBlocks('{"name":"Wren"}')).toBe('');
  });
});

describe('scoreRefusal', () => {
  it('passes a reply that names the World Editor and drafts nothing', () => {
    expect(scoreRefusal('I can only make entities in the World Editor. Open a world there and ask again!').pass).toBe(true);
  });

  it('fails a reply that drafts anyway', () => {
    expect(scoreRefusal(`Open the World Editor first, but here:\n\n${GOOD}`)).toMatchObject({ noBlock: false, pass: false });
  });

  it('fails a reply that never names the World Editor', () => {
    expect(scoreRefusal('Sorry, I cannot do that here.')).toMatchObject({ namesEditor: false, pass: false });
  });
});

describe('readFitGrade', () => {
  it('reads the grade and reason in any case and with bold labels', () => {
    expect(readFitGrade('**Fit:** Yes\n**Why:** It matches the dark fantasy tone.')).toEqual({ fit: true, why: 'It matches the dark fantasy tone.' });
    expect(readFitGrade('fit: no\nwhy: modern slang')).toEqual({ fit: false, why: 'modern slang' });
  });

  it('gives no grade for a reply without a Fit line', () => {
    expect(readFitGrade('I think it fits.')).toBeNull();
  });
});
