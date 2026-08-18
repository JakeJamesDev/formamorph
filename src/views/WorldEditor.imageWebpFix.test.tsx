import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { benchEditorWorld, clickOpenBench, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * Guards the World Doctor's one asynchronous repair — converting a world's images to lossless WebP —
 * through the real editor.
 *
 * The rule pass, the row, the write-back and the dirty flag are all real here; only the encoder is stubbed,
 * so a test decides what came back from it and when. That is what lets these tests be about the two things
 * an encoder can't be asked to prove: that a result about a world the author has since edited never lands,
 * and that a result which isn't WebP is refused rather than written.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: () => Promise.resolve([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

vi.mock('@/lib/imageOptimWorkerClient', () => ({
  encodeInWorker: vi.fn(),
  measureInWorker: vi.fn().mockResolvedValue({ w: 64, h: 64, bytes: 100 }),
  supportsWebp: () => true,
  terminateImageOptimWorker: vi.fn(),
}));

import { toast } from 'react-toastify';
import { encodeInWorker } from '@/lib/imageOptimWorkerClient';

const image = (mime: string, seed = 'A') => `data:${mime};base64,${seed.repeat(64)}`;
const PNG = image('image/png');
const JPEG = image('image/jpeg');
const GIF = image('image/gif');
const WEBP = image('image/webp', 'B');

/** A portrait a WebP conversion improves and a photo it doesn't, so every run has something to leave alone.
 *  The cast is the fixture, here and below: a suite supplies only the slices its tests are about, the way
 *  hand-authored world JSON arrives with fields the types call required simply absent. */
const WORLD = benchEditorWorld({
  entities: [{
    id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.',
    aiDescription: 'Keeps the harbor lamps lit.', locations: ['harbor'], images: [PNG],
  }],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, backgroundImage: JPEG }],
} as unknown as Partial<World>);

const setup = (world: World = WORLD) => renderWorldEditorBench(world, 'advanced');

/** Open the Bench and hand back the conversion row's Fix button. */
const openBench = async () => {
  await clickOpenBench();
  return screen.findByRole('button', { name: /^Fix/ });
};

/** A run the test finishes by hand, so the world can be edited while the encode is still in flight. */
const deferredEncode = () => {
  let finish!: (url: string) => void;
  vi.mocked(encodeInWorker).mockReturnValue(new Promise<string>((resolve) => { finish = resolve; }));
  return (url: string) => act(async () => { finish(url); });
};

type WorldPayload = Omit<World, 'id' | 'version'>;

const imagesOf = (ctx: () => { getWorldData: () => WorldPayload }) => {
  const world = ctx().getWorldData();
  return { portrait: world.entities[0].images?.[0], background: world.locations[0].backgroundImage };
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(encodeInWorker).mockResolvedValue(WEBP);
});

describe('WorldEditor — converting a world’s images to lossless WebP', () => {
  it('flags the convertible image and offers the repair on its row', async () => {
    setup();
    expect(await openBench()).toBeInTheDocument();
    expect(screen.getByText(/PNG — converting it to lossless WebP/)).toBeInTheDocument();
    // Nothing runs until the author asks: the encode is the expensive half.
    expect(encodeInWorker).not.toHaveBeenCalled();
  });

  it('converts through the editor’s own write-back, leaving the photo alone', async () => {
    const { ctx } = setup();
    const button = await openBench();
    expect(ctx().isWorldDirty).toBe(false);

    await act(async () => { fireEvent.click(button); });

    expect(imagesOf(ctx)).toEqual({ portrait: WEBP, background: JPEG });
    // A conversion is a hand edit made all at once — so Exit Without Saving is still the whole undo.
    expect(ctx().isWorldDirty).toBe(true);
    expect(encodeInWorker).toHaveBeenCalledTimes(1);
  });

  it('clears the row once the pass has run again over the converted world', async () => {
    setup();
    const button = await openBench();
    await act(async () => { fireEvent.click(button); });
    await waitFor(
      () => expect(screen.queryByText(/converting it to lossless WebP/)).toBeNull(),
      { timeout: 2000 },
    );
  });

  it('drops a conversion of images the author edited while it was running', async () => {
    const { ctx } = setup();
    const button = await openBench();

    const finish = deferredEncode();
    fireEvent.click(button);
    // The author replaces the very picture being converted before the encode comes back.
    act(() => {
      ctx().setEntities([{ ...WORLD.entities[0], images: [image('image/png', 'C')] }]);
    });
    await finish(WEBP);

    // The stale result named an image the world no longer holds; writing it back would restore it.
    expect(imagesOf(ctx).portrait).toBe(image('image/png', 'C'));
  });

  it('refuses a result that isn’t WebP — a lossless repair never becomes a lossy one', async () => {
    const { ctx } = setup();
    const button = await openBench();
    // What the encoder falls back to where WebP encoding is unavailable.
    vi.mocked(encodeInWorker).mockResolvedValue(image('image/jpeg', 'D'));

    await act(async () => { fireEvent.click(button); });

    expect(imagesOf(ctx).portrait).toBe(PNG);
    expect(ctx().isWorldDirty).toBe(false);
  });

  it('says how many images it kept, so a row that stays put reads as a fact', async () => {
    setup();
    const button = await openBench();
    // The grow-guard's own answer: a WebP copy that came out bigger, so the original is handed back.
    vi.mocked(encodeInWorker).mockImplementation((url: string) => Promise.resolve(url));

    await act(async () => { fireEvent.click(button); });

    expect(toast.info).toHaveBeenCalledWith('Kept 1 image as it was — WebP wouldn’t make it smaller.');
  });

  it('says nothing when every image it looked at converted', async () => {
    setup();
    const button = await openBench();
    await act(async () => { fireEvent.click(button); });
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('shows the work and refuses a second run while one is in flight', async () => {
    setup();
    const button = await openBench();

    const finish = deferredEncode();
    fireEvent.click(button);
    const running = await screen.findByRole('button', { name: 'Fixing…' });
    expect(running).toBeDisabled();
    fireEvent.click(running);

    await finish(WEBP);
    expect(encodeInWorker).toHaveBeenCalledTimes(1);
  });
});

describe('WorldEditor — a world whose pictures live in more than one place', () => {
  // The thumbnail writes back through `updateWorldOverview`, which merges rather than replaces — its own
  // path through the write-back, and the one slot that isn't in a list.
  const SPREAD = benchEditorWorld({
    worldOverview: {
      name: 'Sedge Landing', description: '', author: '', thumbnail: PNG, bgm: null,
      systemPrompt: 'Narrate the fen.', readme: 'A fen primer.', use3DModel: true, tags: [],
    },
    entities: [{
      id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.',
      aiDescription: 'Keeps the harbor lamps lit.', locations: ['harbor'],
      images: [image('image/png', 'E'), image('image/bmp', 'F')],
    }],
    locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, backgroundImage: image('image/png', 'G') }],
  } as unknown as Partial<World>);

  it('converts the thumbnail, the gallery and the background in one run', async () => {
    const { ctx } = setup(SPREAD);
    const button = await openBench();
    // Four images across three slots read as one problem, so one button repairs all of them.
    expect(button).toHaveTextContent('Fix All');

    await act(async () => { fireEvent.click(button); });

    const world = ctx().getWorldData();
    expect(world.worldOverview.thumbnail).toBe(WEBP);
    expect(world.entities[0].images).toEqual([WEBP, WEBP]);
    expect(world.locations[0].backgroundImage).toBe(WEBP);
  });

  it('counts every image it kept, however many that is', async () => {
    setup(SPREAD);
    const button = await openBench();
    // Only the thumbnail comes back smaller; the encoder's grow-guard hands the other three back as-is.
    vi.mocked(encodeInWorker).mockImplementation((url: string) =>
      Promise.resolve(url === PNG ? WEBP : url));

    await act(async () => { fireEvent.click(button); });

    expect(toast.info).toHaveBeenCalledWith(
      'Converted 1 image to WebP. Kept 3 images as they were — WebP wouldn’t make them smaller.',
    );
  });
});

describe('WorldEditor — converting a GIF the browser can’t re-encode as animation', () => {
  const GIF_WORLD = benchEditorWorld({
    locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, backgroundImage: GIF }],
  } as unknown as Partial<World>);

  afterEach(() => {
    delete (globalThis as { ImageDecoder?: unknown }).ImageDecoder;
  });

  it('leaves it exactly as it is rather than flattening it', async () => {
    // jsdom has no WebCodecs, which is also Safari's situation — the encoder's animated path is unavailable
    // there, so converting would cost the author the animation.
    expect('ImageDecoder' in globalThis).toBe(false);
    const { ctx } = setup(GIF_WORLD);
    const button = await openBench();

    await act(async () => { fireEvent.click(button); });

    expect(ctx().getWorldData().locations[0].backgroundImage).toBe(GIF);
    expect(encodeInWorker).not.toHaveBeenCalled();
    // Said as the reason it actually is: this GIF isn't one WebP couldn't shrink, it is one this browser
    // can't convert without costing the author the animation.
    expect(toast.info).toHaveBeenCalledWith(
      'Left 1 GIF alone — converting it in this browser would flatten its animation.',
    );
  });

  it('converts it where the frames can actually be decoded', async () => {
    (globalThis as { ImageDecoder?: unknown }).ImageDecoder = class {};
    const { ctx } = setup(GIF_WORLD);
    const button = await openBench();

    await act(async () => { fireEvent.click(button); });

    expect(ctx().getWorldData().locations[0].backgroundImage).toBe(WEBP);
  });
});
