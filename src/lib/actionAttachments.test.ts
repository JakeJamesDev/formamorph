// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATTACHMENT_MAX_DIM, MAX_ATTACHMENTS, addToPending, joinPending, pruneAttachments, withoutAttachment, restoreAttachments, turnAttachments,
  latestTurnAttachments, pageTurnId, setTurnAttachments,
} from './actionAttachments';
import type { ChatMessage, ImageAttachment } from '@/types';
import { decodedFake, fakeImageFile, installFakeImageCodec } from '@/test/fakeImageCodec';

/** The store through the real encode path, with only the platform's image codec faked (see the helper). */
beforeEach(installFakeImageCodec);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const photo = fakeImageFile;
const decoded = (attachment: ImageAttachment) => decodedFake(attachment.dataUrl);

describe('addToPending', () => {
  it('shrinks a large image to the long-side cap and keeps its shape', async () => {
    const { pending, refused } = await addToPending([], [photo('4000x3000')]);
    expect(refused).toEqual([]);
    expect(decoded(pending[0]).size).toBe(`${ATTACHMENT_MAX_DIM}x1176`);
  });

  it('caps a tall image on its height', async () => {
    const { pending } = await addToPending([], [photo('1000x4704')]);
    expect(decoded(pending[0]).size).toBe(`333x${ATTACHMENT_MAX_DIM}`);
  });

  it('never enlarges a small image', async () => {
    const { pending } = await addToPending([], [photo('800x600')]);
    expect(decoded(pending[0]).size).toBe('800x600');
  });

  it('re-encodes every image as JPEG, even when that is not smaller', async () => {
    const { pending } = await addToPending([], [photo('800x600'), photo('20x20', 'image/webp', 'tiny.webp')]);
    expect(pending).toHaveLength(2);
    for (const attachment of pending) {
      expect(decoded(attachment).format).toBe('image/jpeg');
      expect(attachment.mime).toBe('image/jpeg');
    }
  });

  it('adds after what is already pending, in the order given, each with its own id', async () => {
    const first = await addToPending([], [photo('100x100')]);
    const { pending } = await addToPending(first.pending, [photo('200x200'), photo('300x300')]);
    expect(pending.map((a) => decoded(a).size)).toEqual(['100x100', '200x200', '300x300']);
    expect(new Set(pending.map((a) => a.id)).size).toBe(3);
  });

  it('refuses a file that is not an image and keeps the rest', async () => {
    const notes = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const { pending, refused } = await addToPending([], [notes, photo('100x100')]);
    expect(refused).toEqual(['notImage']);
    expect(pending).toHaveLength(1);
  });

  it(`refuses an image past the ${MAX_ATTACHMENTS}-image cap`, async () => {
    const three = (await addToPending([], [photo('1x1'), photo('2x2'), photo('3x3')])).pending;
    const { pending, refused } = await addToPending(three, [photo('4x4'), photo('5x5')]);
    expect(pending.map((a) => decoded(a).size)).toEqual(['1x1', '2x2', '3x3', '4x4']);
    expect(refused).toEqual(['limit']);
  });

  it('refuses an image the browser cannot read', async () => {
    vi.stubGlobal('createImageBitmap', async () => { throw new Error('undecodable'); });
    const { pending, refused } = await addToPending([], [photo('100x100', 'image/heic', 'photo.heic')]);
    expect(pending).toEqual([]);
    expect(refused).toEqual(['unreadable']);
  });
});

describe('withoutAttachment', () => {
  it('removes one image by id and keeps the order of the rest', async () => {
    const { pending } = await addToPending([], [photo('1x1'), photo('2x2'), photo('3x3')]);
    const left = withoutAttachment(pending, pending[1].id);
    expect(left.map((a) => decoded(a).size)).toEqual(['1x1', '3x3']);
  });
});

describe('joinPending', () => {
  const image = (id: string): ImageAttachment => ({ id, mime: 'image/webp', dataUrl: `data:image/webp;base64,${id}` });

  it('appends in order when there is room', () => {
    const { pending, overflow } = joinPending([image('a')], [image('b'), image('c')]);
    expect(pending.map((a) => a.id)).toEqual(['a', 'b', 'c']);
    expect(overflow).toBe(false);
  });

  it('keeps the set at the cap and reports what did not fit', () => {
    const full = Array.from({ length: MAX_ATTACHMENTS - 1 }, (_, i) => image(`p${i}`));
    const { pending, overflow } = joinPending(full, [image('x'), image('y')]);
    expect(pending).toHaveLength(MAX_ATTACHMENTS);
    expect(pending.at(-1)?.id).toBe('x');
    expect(overflow).toBe(true);
  });
});

describe('the turn map', () => {
  const image = (id: string): ImageAttachment => ({ id, mime: 'image/webp', dataUrl: `data:image/webp;base64,${id}` });
  const turn = (turnId: string): ChatMessage[] => [
    { role: 'user', content: 'I look around.' },
    { role: 'assistant', content: JSON.stringify({ narration: 'You see a pier.', choices: [], stat_changes: [], turnId }) },
  ];

  it("stores a turn's images and reads them back in order", () => {
    const map = setTurnAttachments({}, 'turn-1', [image('a'), image('b')]);
    expect(turnAttachments(map, 'turn-1').map((a) => a.id)).toEqual(['a', 'b']);
    expect(turnAttachments(map, 'turn-2')).toEqual([]);
  });

  it('stores nothing for a turn with no images', () => {
    expect(setTurnAttachments({}, 'turn-1', [])).toEqual({});
  });

  it('drops the images of turns no longer in the history', () => {
    const map = setTurnAttachments(setTurnAttachments({}, 'kept', [image('a')]), 'rolled-back', [image('b')]);
    expect(Object.keys(pruneAttachments(map, turn('kept')))).toEqual(['kept']);
  });

  it("reads the latest turn's images, the ones a regenerate sends again", () => {
    const map = setTurnAttachments(setTurnAttachments({}, 'first', [image('a')]), 'second', [image('b'), image('c')]);
    expect(latestTurnAttachments(map, [...turn('first'), ...turn('second')]).map((a) => a.id)).toEqual(['b', 'c']);
    expect(latestTurnAttachments(map, [...turn('second'), ...turn('first')]).map((a) => a.id)).toEqual(['a']);
    expect(latestTurnAttachments(map, [])).toEqual([]);
  });

  it('names the turn on each page, and none for a page past the history', () => {
    const history = [...turn('first'), ...turn('second')];
    expect([1, 2, 3].map((page) => pageTurnId(history, page))).toEqual(['first', 'second', undefined]);
  });

  it("replaces a turn's images and drops the entry when none are left", () => {
    const map = setTurnAttachments(setTurnAttachments({}, 'other', [image('x')]), 'turn-1', [image('a'), image('b')]);
    expect(turnAttachments(setTurnAttachments(map, 'turn-1', [image('b')]), 'turn-1').map((a) => a.id)).toEqual(['b']);
    expect(setTurnAttachments(map, 'turn-1', [])).toEqual({ other: [image('x')] });
  });
});

describe('the save map', () => {
  const image = (id: string): ImageAttachment => ({ id, mime: 'image/webp', dataUrl: `data:image/webp;base64,${id}` });

  it('reads a written map back with every turn and image in order', () => {
    const map = setTurnAttachments(setTurnAttachments({}, 'turn-1', [image('a'), image('b')]), 'turn-2', [image('c')]);
    expect(restoreAttachments(JSON.parse(JSON.stringify(map)))).toEqual(map);
  });

  it('reads an absent map as none', () => {
    expect(restoreAttachments(undefined)).toEqual({});
    expect(restoreAttachments(null)).toEqual({});
  });

  it('reads a map that is not an object as none', () => {
    for (const raw of ['text', 7, true, [image('a')]]) expect(restoreAttachments(raw)).toEqual({});
  });

  it('leaves out entries that are not lists of images, so a hand-edited save still loads', () => {
    const restored = restoreAttachments({
      ok: [
        image('a'),
        { id: 'x', mime: 'image/webp' },
        { id: 'y', mime: 'image/webp', dataUrl: 'javascript:alert(1)' },
        { id: 'z', mime: 'text/html', dataUrl: 'data:image/webp;base64,zz' },
        { id: 7, mime: 'image/webp', dataUrl: 'data:image/webp;base64,zz' },
      ],
      notAList: 'data:image/webp;base64,zz',
      empty: [],
    });
    expect(restored).toEqual({ ok: [image('a')] });
  });

  it(`keeps at most ${MAX_ATTACHMENTS} images for a turn`, () => {
    const many = Array.from({ length: MAX_ATTACHMENTS + 2 }, (_, i) => image(`i${i}`));
    expect(restoreAttachments({ t: many }).t).toHaveLength(MAX_ATTACHMENTS);
  });
});
