import { describe, expect, it } from 'vitest';
import { entityAddNote, openEntityFence, readEntityBlock, sentenceCount } from './entityBlock';

const problems = (text: string) => {
  const read = readEntityBlock(text);
  return read.ok ? [] : read.problems;
};

describe('readEntityBlock', () => {
  it('reads a Name and a one-line AI Description', () => {
    expect(readEntityBlock('Name: Maren Holt\nAI Description: A gate guard who knows every face in town.')).toEqual({
      ok: true,
      draft: { name: 'Maren Holt', aiDescription: 'A gate guard who knows every face in town.' },
    });
  });

  it('runs the AI Description to the end of the block, its own labeled lines included', () => {
    const read = readEntityBlock('Name: Ash\nAI Description: A tinker.\nAppearance: soot on both hands.\n\nShe trades in rumors.');
    expect(read).toEqual({ ok: true, draft: { name: 'Ash', aiDescription: 'A tinker.\nAppearance: soot on both hands.\n\nShe trades in rumors.' } });
  });

  it('starts the AI Description on the line after its label', () => {
    expect(readEntityBlock('Name: Ash\nAI Description:\nA tinker.')).toEqual({ ok: true, draft: { name: 'Ash', aiDescription: 'A tinker.' } });
  });

  it('matches labels in any case', () => {
    expect(readEntityBlock('NAME: Ash\nai description: A tinker.')).toEqual({ ok: true, draft: { name: 'Ash', aiDescription: 'A tinker.' } });
    expect(readEntityBlock('name: Ash\nAi  Description: A tinker.')).toMatchObject({ ok: true });
  });

  it('skips blank lines around the labels', () => {
    expect(readEntityBlock('\nName: Ash\n\nAI Description: A tinker.\n')).toMatchObject({ ok: true });
  });

  it('accepts four sentences and refuses five', () => {
    expect(readEntityBlock('Name: Ash\nAI Description: One. Two! Three? Four.')).toMatchObject({ ok: true });
    expect(problems('Name: Ash\nAI Description: One. Two! Three? Four. Five.')).toEqual(['AI Description over 4 sentences']);
  });

  it('refuses a block with no Name, an empty Name, or two Names', () => {
    expect(problems('AI Description: A tinker.')).toEqual(['No Name']);
    expect(problems('Name:   \nAI Description: A tinker.')).toEqual(['No Name']);
    expect(problems('Name: Ash\nName: Birch\nAI Description: A tinker.')).toEqual(['More than one Name']);
  });

  it('refuses a block with no AI Description or an empty one', () => {
    expect(problems('Name: Ash')).toEqual(['No AI Description']);
    expect(problems('Name: Ash\nAI Description:   \n  ')).toEqual(['No AI Description']);
  });

  it('refuses any other label before the AI Description', () => {
    expect(problems('Name: Ash\nType: tinker\nAI Description: A tinker.')).toEqual(['Unknown label: Type']);
    expect(problems('Name: Ash\nPlayer Description: A tinker.\nAI Description: A tinker.')).toEqual(['Unknown label: Player Description']);
  });

  it('refuses an unlabeled line before the AI Description', () => {
    expect(problems('Here is your entity\nName: Ash\nAI Description: A tinker.')).toEqual(['Unlabeled line: Here is your entity']);
  });

  it('keeps the fields it read when the block is refused', () => {
    expect(readEntityBlock('Name: Ash\nAI Desc')).toEqual({ ok: false, problems: ['Unlabeled line: AI Desc', 'No AI Description'], partial: { name: 'Ash' } });
  });
});

describe('sentenceCount', () => {
  it.each([
    ['A tinker', 1],
    ['A tinker.', 1],
    ['A tinker. She trades', 2],
    ['"Stay back." He means it.', 2],
    ['Wait... what?', 2],
    ['Version 2.5 of the plan.', 1],
    ['  ', 0],
  ])('counts %j as %i', (text, count) => {
    expect(sentenceCount(text)).toBe(count);
  });
});

describe('openEntityFence', () => {
  it('returns the text of an entity fence that has not closed', () => {
    expect(openEntityFence('Here you go:\n\n```entity\nName: Ash\nAI Desc')).toBe('Name: Ash\nAI Desc');
  });

  it('returns null once the fence closes, and for a fence of another language', () => {
    expect(openEntityFence('```entity\nName: Ash\n```\nDone.')).toBeNull();
    expect(openEntityFence('```js\nreturn 1;')).toBeNull();
  });

  it('finds the open fence after a closed one', () => {
    expect(openEntityFence('```entity\nName: A\n```\n\n```Entity\nName: B\n')).toBe('Name: B');
  });

  it('needs a closing fence as long as the opening one', () => {
    expect(openEntityFence('````entity\nName: Ash\n```\n')).toBe('Name: Ash\n```');
  });
});

describe('entityAddNote', () => {
  it('names one entity or several', () => {
    expect(entityAddNote(['Ash'])).toBe('The player added this entity to the world from your entity blocks: Ash.');
    expect(entityAddNote(['Ash', 'Birch'])).toBe('The player added these entities to the world from your entity blocks: Ash, Birch.');
  });
});
