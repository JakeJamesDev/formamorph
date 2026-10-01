import { describe, expect, it } from 'vitest';
import { GENERAL_KNOWLEDGE_MARKER, readMarker } from './generalKnowledge';

describe('readMarker', () => {
  it('reads and removes the marker on the first line', () => {
    expect(readMarker(`${GENERAL_KNOWLEDGE_MARKER}\nA sampler picks the next word.`)).toEqual({
      text: 'A sampler picks the next word.',
      marked: true,
    });
  });

  it('leaves an answer with no marker as it is', () => {
    expect(readMarker('1. Select **Save**.')).toEqual({ text: '1. Select **Save**.', marked: false });
  });

  it('reads the marker in another case, in bold, or with a colon', () => {
    for (const written of ['[not in guide]', '**[NOT IN GUIDE]**', '[Not in the guide]:', '[ NOT IN GUIDE ]']) {
      expect(readMarker(`${written} The answer.`)).toEqual({ text: 'The answer.', marked: true });
    }
  });

  it('reads a marker that is not on the first line, and removes it there', () => {
    expect(readMarker(`The answer.\n\n${GENERAL_KNOWLEDGE_MARKER}`)).toEqual({ text: 'The answer.', marked: true });
  });

  it('holds back a start that can still grow into the marker, so no part of it shows', () => {
    expect(readMarker('[NOT IN')).toEqual({ text: '', marked: false });
    expect(readMarker('**[not')).toEqual({ text: '', marked: false });
    expect(readMarker('[')).toEqual({ text: '', marked: false });
  });

  it('shows a held start once the text grows past the marker', () => {
    expect(readMarker('[NOT IN GUIDE]\nThe')).toEqual({ text: 'The', marked: true });
    expect(readMarker('[Note] The answer.')).toEqual({ text: '[Note] The answer.', marked: false });
  });

  it('shows a held start at the end of the stream, because it was not the marker', () => {
    expect(readMarker('[NOT IN', { final: true })).toEqual({ text: '[NOT IN', marked: false });
  });

  it('reads a marker split across two chunks of a stream', () => {
    const chunks = ['[NOT I', 'N GUIDE]\nThe answer.'];
    let content = '';
    const seen = chunks.map((chunk) => readMarker((content += chunk)));
    expect(seen.map((step) => step.text)).toEqual(['', 'The answer.']);
    expect(seen.at(-1)?.marked).toBe(true);
  });
});
