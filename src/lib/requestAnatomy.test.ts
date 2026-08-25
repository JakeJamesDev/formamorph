import { describe, it, expect } from 'vitest';
import {
  tilePieces,
  trimEndTiled,
  runsTile,
  toAnatomyBlocks,
  CONTEXT_LABELS,
  SOURCE_LABELS,
  type AnatomyRun,
} from './requestAnatomy';

/** Slice a tiled result by each run, so an assertion reads the text a label actually points at. */
const sliced = (content: string, runs: AnatomyRun[]) => runs.map((r) => content.slice(r.start, r.end));

describe('tilePieces', () => {
  it('covers the joined content exactly, in order', () => {
    const { content, runs } = tilePieces([
      { text: 'You are the narrator.\n\n', source: 'system-template' },
      { text: 'Sedge Landing is drowned.', contextLabel: 'world-data' },
    ]);
    expect(content).toBe('You are the narrator.\n\nSedge Landing is drowned.');
    expect(runsTile(content, runs)).toBe(true);
    expect(sliced(content, runs)).toEqual(['You are the narrator.\n\n', 'Sedge Landing is drowned.']);
    expect(runs.map((r) => r.source ?? r.contextLabel)).toEqual(['system-template', 'world-data']);
  });

  it('drops empty pieces without leaving a zero-width run', () => {
    const { content, runs } = tilePieces([
      { text: 'kept', source: 'system-template' },
      { text: '', contextLabel: 'world-data' },
    ]);
    expect(content).toBe('kept');
    expect(runs).toHaveLength(1);
  });

  it('merges adjacent pieces that share a label', () => {
    const { content, runs } = tilePieces([
      { text: 'a', contextLabel: 'condensed' },
      { text: 'b', contextLabel: 'condensed' },
      { text: 'c', contextLabel: 'notes' },
    ]);
    expect(runs).toHaveLength(2);
    expect(sliced(content, runs)).toEqual(['ab', 'c']);
  });

  it('does not merge an authored run into a context run that carries no label', () => {
    const { content, runs } = tilePieces([
      { text: 'x', source: 'recap' },
      { text: 'y' },
    ]);
    expect(runs).toHaveLength(2);
    expect(sliced(content, runs)).toEqual(['x', 'y']);
  });

  it('gives glue to the run before it, so the next run starts on its own first character', () => {
    const { content, runs } = tilePieces([
      { text: 'digest text', contextLabel: 'condensed' },
      { text: '\n\n', glue: true },
      { text: 'Now you are at the Reed Flats.', source: 'now' },
    ]);
    expect(runsTile(content, runs)).toBe(true);
    expect(sliced(content, runs)).toEqual(['digest text\n\n', 'Now you are at the Reed Flats.']);
    expect(runs[1].source).toBe('now');
  });

  it('gives leading glue to the run after it, since there is none before', () => {
    const { content, runs } = tilePieces([
      { text: '\n\n', glue: true },
      { text: 'rider', source: 'direction' },
    ]);
    expect(runsTile(content, runs)).toBe(true);
    expect(runs).toHaveLength(1);
    expect(sliced(content, runs)).toEqual(['\n\nrider']);
  });

  it('keeps trailing glue inside the content it follows', () => {
    const { content, runs } = tilePieces([
      { text: 'body', source: 'recap' },
      { text: '\n', glue: true },
    ]);
    expect(content).toBe('body\n');
    expect(runsTile(content, runs)).toBe(true);
  });

  it('tiles glue with nothing at all around it', () => {
    const { content, runs } = tilePieces([{ text: '\n\n', glue: true }]);
    expect(content).toBe('\n\n');
    expect(runsTile(content, runs)).toBe(true);
  });
});

describe('trimEndTiled', () => {
  it('clamps the last run to the trimmed content', () => {
    const tiled = tilePieces([
      { text: 'kept', source: 'system-template' },
      { text: 'value\n\n\n', contextLabel: 'world-data' },
    ]);
    const trimmed = trimEndTiled(tiled);
    expect(trimmed.content).toBe('keptvalue');
    expect(runsTile(trimmed.content, trimmed.runs)).toBe(true);
    expect(sliced(trimmed.content, trimmed.runs)).toEqual(['kept', 'value']);
  });

  it('drops a run that trimming erases entirely', () => {
    const tiled = tilePieces([
      { text: 'kept', source: 'system-template' },
      { text: '\n\n', contextLabel: 'world-data' },
    ]);
    const trimmed = trimEndTiled(tiled);
    expect(trimmed.content).toBe('kept');
    expect(trimmed.runs).toHaveLength(1);
    expect(runsTile(trimmed.content, trimmed.runs)).toBe(true);
  });

  it('leaves content with nothing to trim untouched', () => {
    const tiled = tilePieces([{ text: 'exact', source: 'recap' }]);
    expect(trimEndTiled(tiled)).toBe(tiled);
  });
});

describe('runsTile', () => {
  it('rejects a gap, an overlap, and a short tail', () => {
    expect(runsTile('abcdef', [{ start: 0, end: 2 }, { start: 3, end: 6 }])).toBe(false);
    expect(runsTile('abcdef', [{ start: 0, end: 4 }, { start: 2, end: 6 }])).toBe(false);
    expect(runsTile('abcdef', [{ start: 0, end: 4 }])).toBe(false);
    expect(runsTile('abcdef', [{ start: 0, end: 4 }, { start: 4, end: 6 }])).toBe(true);
  });

  it('accepts no runs only for empty content', () => {
    expect(runsTile('', [])).toBe(true);
    expect(runsTile('x', [])).toBe(false);
  });
});

describe('toAnatomyBlocks', () => {
  const wire = [
    { role: 'system' as const, content: 'SYS' },
    { role: 'user' as const, content: 'ONE' },
    { role: 'assistant' as const, content: 'TWO' },
  ];

  it('gives wire message 0 the system runs and the rest their own', () => {
    const blocks = toAnatomyBlocks(wire, {
      system: [{ start: 0, end: 3, source: 'system-template' }],
      messages: [[{ start: 0, end: 3, source: 'recap' }], [{ start: 0, end: 3, contextLabel: 'condensed' }]],
    });
    expect(blocks.map((b) => b.runs[0].source ?? b.runs[0].contextLabel)).toEqual([
      'system-template', 'recap', 'condensed',
    ]);
    expect(blocks.map((b) => b.content)).toEqual(['SYS', 'ONE', 'TWO']);
  });

  it('renders every block unlabeled when there is no sidecar (a pre-anatomy capture)', () => {
    expect(toAnatomyBlocks(wire).every((b) => b.runs.length === 0)).toBe(true);
  });

  it('leaves a message unlabeled when the sidecar is shorter than the wire', () => {
    const blocks = toAnatomyBlocks(wire, { system: [], messages: [[{ start: 0, end: 3, source: 'recap' }]] });
    expect(blocks[2].runs).toEqual([]);
  });
});

describe('label vocabulary', () => {
  it('names an editor surface for every source', () => {
    expect(Object.values(SOURCE_LABELS).every((v) => v.length > 0)).toBe(true);
  });

  it('describes every context label in the player voice, with no duplicates', () => {
    const values = Object.values(CONTEXT_LABELS);
    expect(new Set(values).size).toBe(values.length);
  });
});
