import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { GUIDE_SEMANTIC_FLOOR } from '@/lib/formaquestion/helpSession';

// No test here asks a question.
vi.mock('./useHelpAi', () => import('@/test/idleHelpAi'));

const docs = vi.hoisted(() => ({
  pages: {
    Stats: '# 📊 Stats\n\nStats are numbers.\n\n## The Panel\n\nThe panel shows each number.\n',
    Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\nSelect **Add** on the Traits tab.\n',
  },
  sidebar: '- [Stats](Stats)\n- [Traits](Traits)\n',
  /** The section vectors: the panel along (1, 0), the trait how-to along (0, 1). */
  along: { 'Stats#the-panel': [1, 0], 'Traits#how-to-add-a-trait': [0, 1] } as Record<string, number[]>,
}));
const fixtureIndex = () => createDocsIndex(docs);
const PANEL = 'Stats#the-panel';
const ADD_TRAIT = 'Traits#how-to-add-a-trait';

// The shipped section vectors, made for the fixture docs.
vi.mock('@/lib/formaquestion/sectionVectors.json', async () => {
  const { createDocsIndex: create } = await import('@/lib/docs/docsIndex');
  const { encodeVector, sectionTexts } = await import('@/lib/formaquestion/sectionVectors');
  const { EMBEDDING_MODEL_ID } = await import('@/lib/memoryRelevance');
  const sections = sectionTexts(create(docs)).flatMap(({ section, hash }) =>
    (docs.along[section.id] ? [{ id: section.id, hash, vector: encodeVector(Float32Array.from(docs.along[section.id])) }] : []));
  return { default: { model: EMBEDDING_MODEL_ID, dims: 2, sections } };
});

/** The query vectors of the embedding model: no fixture word is in either meaning query. */
const MEANING: Record<string, [number, number]> = {
  'jot down remarks': [1, 0],
  'scribble notes': [0, 1],
  zzqqxx: [GUIDE_SEMANTIC_FLOOR - 0.01, 0],
};

const model = vi.hoisted(() => ({
  ready: true,
  cached: true,
  load: vi.fn(async () => {}),
  /** Each embed call waits on its own gate when one is set. */
  gate: null as Promise<void> | null,
  embed: vi.fn<(texts: string[]) => Promise<Float32Array[]>>(),
}));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  isEmbeddingModelReady: () => model.ready,
  isEmbeddingModelCached: async () => model.cached,
  loadEmbeddingModel: () => model.load(),
  openCachedEmbeddingModel: async () => model.ready || model.cached,
  embedTexts: (texts: string[]) => model.embed(texts),
}));
import { storeFramedWindow } from '@/test/helpFixtures';
import { Formaquestion } from './Formaquestion';
import { SEMANTIC_PAUSE_MS } from './useGuideSearch';

/** The player set the switch, so the offer card is answered. */
const storeSemantic = (on: boolean) => storeFramedWindow({ sources: { semantic: on }, semanticOffer: 'decided' });

async function openSearch() {
  const view = render(<Formaquestion loadIndex={() => Promise.resolve(fixtureIndex())} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  await screen.findByRole('textbox', { name: 'Ask a Question' });
  await userEvent.click(screen.getByRole('tab', { name: 'Search' }));
  return view;
}

/** Waits this long on real timers, inside act. */
const settle = (ms: number) => act(() => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
/** Runs the fake clock to the end of the typing pause. */
const pastPause = () => act(() => vi.advanceTimersByTimeAsync(SEMANTIC_PAUSE_MS));
const type = (text: string) => fireEvent.change(screen.getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: text } });
const resultHeadings = () => within(screen.getByRole('list', { name: 'Search Results' })).getAllByRole('button').map((row) => row.querySelector('span')?.textContent);
const headingOf: Record<string, string> = { [PANEL]: 'The Panel', [ADD_TRAIT]: 'How to Add a Trait' };

/** A gate the next embed calls wait on, opened by hand. */
function holdEmbeds() {
  let open: () => void = () => {};
  model.gate = new Promise<void>((resolve) => { open = resolve; });
  return () => act(async () => { model.gate = null; open(); });
}

beforeEach(() => {
  localStorage.clear();
  model.ready = true;
  model.cached = true;
  model.gate = null;
  model.load.mockClear();
  model.embed.mockReset();
  model.embed.mockImplementation(async (texts) => {
    const gate = model.gate;
    if (gate) await gate;
    return texts.map((text) => Float32Array.from(MEANING[text] ?? [0, 0]));
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the Search tab with Semantic Search', () => {
  it('finds a section by meaning alone when the switch is on', async () => {
    storeSemantic(true);
    await openSearch();
    type('jot down remarks');
    await waitFor(() => expect(resultHeadings()).toEqual([headingOf[PANEL]]));
  });

  it('finds nothing by meaning when the switch is off, and never embeds', async () => {
    storeSemantic(false);
    await openSearch();
    vi.useFakeTimers();
    type('jot down remarks');
    expect(screen.getByRole('status')).toHaveTextContent('No sections match “jot down remarks”');
    await pastPause();
    expect(screen.getByRole('status')).toHaveTextContent('No sections match “jot down remarks”');
    expect(model.embed).not.toHaveBeenCalled();
  });

  it('shows the keyword results at once, before the pause in typing ends', async () => {
    storeSemantic(true);
    await openSearch();
    type('add a trait');
    expect(resultHeadings()[0]).toBe(headingOf[ADD_TRAIT]);
    expect(model.embed).not.toHaveBeenCalled();
    await waitFor(() => expect(model.embed).toHaveBeenCalledTimes(1));
  });

  it('uses the keywords alone with no notice and no download when the model is not on the device', async () => {
    model.ready = false;
    model.cached = false;
    storeSemantic(true);
    await openSearch();
    vi.useFakeTimers();
    type('jot down remarks');
    await pastPause();
    expect(screen.getByRole('status')).toHaveTextContent('No sections match “jot down remarks”');
    type('add a trait');
    await pastPause();
    expect(resultHeadings()[0]).toBe(headingOf[ADD_TRAIT]);
    expect(screen.queryByRole('status')).toBeNull();
    expect(model.load).not.toHaveBeenCalled();
    expect(model.embed).not.toHaveBeenCalled();
  });

  it('shows "No sections match" for a query whose meaning is under the floor', async () => {
    storeSemantic(true);
    await openSearch();
    type('zzqqxx');
    await waitFor(() => expect(model.embed).toHaveBeenCalledTimes(1));
    await settle(50);
    expect(screen.getByRole('status')).toHaveTextContent('No sections match “zzqqxx”');
  });

  it('never replaces the results of newer text with a late ranking of older text', async () => {
    storeSemantic(true);
    await openSearch();
    const openOld = holdEmbeds();
    type('jot down remarks');
    await waitFor(() => expect(model.embed).toHaveBeenCalledTimes(1));
    model.gate = null;
    type('scribble notes');
    await waitFor(() => expect(resultHeadings()).toEqual([headingOf[ADD_TRAIT]]));
    await openOld();
    await settle(50);
    expect(resultHeadings()).toEqual([headingOf[ADD_TRAIT]]);
  });

  it('starts no ranking when the window closes during the pause', async () => {
    storeSemantic(true);
    const view = await openSearch();
    vi.useFakeTimers();
    type('jot down remarks');
    view.unmount();
    await pastPause();
    expect(model.embed).not.toHaveBeenCalled();
  });
});
