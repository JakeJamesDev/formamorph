import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'react-toastify';
import { renderMiddlePanel, stubChatLayout, type Gameplay, type Settings, type TurnFixture } from '@/test/gamePanels';
import { decodedFake, fakeImageFile, installFakeImageCodec } from '@/test/fakeImageCodec';
import { ATTACH_REFUSAL_COPY } from '@/lib/actionAttachments';
import type { ImageAttachment } from '@/types';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const TURNS: TurnFixture[] = [
  { action: 'START GAME', narration: 'The ferry bumps the dock at Sedge Landing.', turnId: 't1' },
  { action: 'I hold up my sketch of the pier.', narration: 'The dockhand squints at it.', turnId: 't2' },
  { action: 'I wave at the gull.', narration: 'The gull does not wave back.', turnId: 't3' },
];

const image = (id: string): ImageAttachment => ({ id, mime: 'image/webp', dataUrl: `data:image/webp;base64,${btoa(`${id}x1`)}` });

const attachOn = (settings: Settings) => settings.setImageAttachments(true);
// Staged turns mean a game under way, as in play.
const started = (g: Gameplay) => g.setIsGameStarted(true);

/** Pick files with the attach button's picker. */
async function pick(...files: File[]) {
  const input = screen.getByTestId('attach-input') as HTMLInputElement;
  await act(async () => { fireEvent.change(input, { target: { files } }); });
}

beforeEach(installFakeImageCodec);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the action box with Image Attachments off', () => {
  it('shows no attach button and no pending images', async () => {
    renderMiddlePanel({}, { turns: TURNS, seed: (g) => g.setPendingAttachments([image('a')]) });
    await screen.findByTestId('action-input-wrap');
    expect(screen.queryByRole('button', { name: 'Attach images' })).toBeNull();
    expect(screen.queryByTestId('attach-input')).toBeNull();
    expect(screen.queryByTestId('attachment-thumbs')).toBeNull();
  });
});

describe('the action box with Image Attachments on', () => {
  it('attaches the picked images as pending thumbnails, in order', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, settings: attachOn, seed: started });
    expect(await screen.findByRole('button', { name: 'Attach images' })).toBeTruthy();
    await pick(fakeImageFile('4000x3000'), fakeImageFile('640x480'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^View attached image/ })).toHaveLength(2));
    expect(view.gameplay().pendingAttachments.map((a) => decodedFake(a.dataUrl).size)).toEqual(['1568x1176', '640x480']);
  });

  it('removes one pending image and keeps the other', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, settings: attachOn, seed: started });
    await pick(fakeImageFile('100x100'), fakeImageFile('200x200'));
    await screen.findByRole('button', { name: 'Remove attached image 2' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove attached image 1' }));
    expect(view.gameplay().pendingAttachments.map((a) => decodedFake(a.dataUrl).size)).toEqual(['200x200']);
    expect(screen.getAllByRole('button', { name: /^View attached image/ })).toHaveLength(1);
  });

  it('refuses a file that is not an image with a toast', async () => {
    const warn = vi.spyOn(toast, 'warning');
    const view = renderMiddlePanel({}, { turns: TURNS, settings: attachOn, seed: started });
    await pick(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    await waitFor(() => expect(warn).toHaveBeenCalledWith(ATTACH_REFUSAL_COPY.notImage));
    expect(view.gameplay().pendingAttachments).toEqual([]);
  });

  it('keeps the images a send took while more were still encoding', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, settings: attachOn, seed: (g) => { started(g); g.setPendingAttachments([image('a'), image('b')]); } });
    await screen.findByRole('button', { name: 'Attach images' });
    // The send clears the box while the third image is still being encoded.
    fireEvent.change(screen.getByTestId('attach-input'), { target: { files: [fakeImageFile('300x300')] } });
    act(() => view.gameplay().setPendingAttachments([]));
    await waitFor(() => expect(view.gameplay().pendingAttachments).toHaveLength(1));
    expect(decodedFake(view.gameplay().pendingAttachments[0].dataUrl).size).toBe('300x300');
  });

  it('offers no attach button before the game starts', async () => {
    renderMiddlePanel({}, { settings: attachOn });
    await screen.findByTestId('action-input-wrap');
    expect(screen.queryByRole('button', { name: 'Attach images' })).toBeNull();
  });

  it('refuses a fifth image with a toast', async () => {
    const warn = vi.spyOn(toast, 'warning');
    const view = renderMiddlePanel({}, { turns: TURNS, settings: attachOn, seed: started });
    await pick(fakeImageFile('1x1'), fakeImageFile('2x2'), fakeImageFile('3x3'), fakeImageFile('4x4'), fakeImageFile('5x5'));
    await waitFor(() => expect(warn).toHaveBeenCalledWith(ATTACH_REFUSAL_COPY.limit));
    expect(view.gameplay().pendingAttachments).toHaveLength(4);
  });
});

/** The box that takes a paste or a drop: the action row's parent. */
const dropZone = () => screen.getByTestId('action-input-wrap').parentElement!.parentElement!;

/** A paste event's clipboard: files plus an optional text flavor. */
const clipboard = (files: File[], text = '') => ({ files, getData: (t: string) => (t === 'text/plain' ? text : '') });
/** A drag's data transfer carrying these files. */
const dragOf = (files: File[]) => ({ files, types: ['Files'], getData: () => '', dropEffect: 'none' });

describe('paste and drop with Image Attachments on', () => {
  const setup = () => renderMiddlePanel({}, { turns: TURNS, settings: attachOn, seed: started });
  const zone = async () => {
    await screen.findByRole('button', { name: 'Attach images' });
    return dropZone();
  };

  it('pastes a clipboard image as a pending attachment', async () => {
    const view = setup();
    const box = await zone();
    await act(async () => { fireEvent.paste(box, { clipboardData: clipboard([fakeImageFile('800x600')]) }); });
    await waitFor(() => expect(view.gameplay().pendingAttachments).toHaveLength(1));
    expect(decodedFake(view.gameplay().pendingAttachments[0].dataUrl).size).toBe('800x600');
  });

  it('leaves a paste that carries text to insert the text', async () => {
    const view = setup();
    const box = await zone();
    const notPrevented = fireEvent.paste(box, { clipboardData: clipboard([fakeImageFile('800x600')], 'A1	B1') });
    expect(notPrevented).toBe(true);
    expect(view.gameplay().pendingAttachments).toEqual([]);
  });

  it('drops image files as pending attachments, in order', async () => {
    const view = setup();
    const box = await zone();
    await act(async () => { fireEvent.drop(box, { dataTransfer: dragOf([fakeImageFile('100x100'), fakeImageFile('200x200')]) }); });
    await waitFor(() => expect(view.gameplay().pendingAttachments).toHaveLength(2));
    expect(view.gameplay().pendingAttachments.map((a) => decodedFake(a.dataUrl).size)).toEqual(['100x100', '200x200']);
  });

  it('refuses a dropped file that is not an image, and keeps the browser from opening it', async () => {
    const warn = vi.spyOn(toast, 'warning');
    const view = setup();
    const box = await zone();
    const notPrevented = fireEvent.drop(box, { dataTransfer: dragOf([new File(['x'], 'a.txt', { type: 'text/plain' })]) });
    expect(notPrevented).toBe(false);
    await waitFor(() => expect(warn).toHaveBeenCalledWith(ATTACH_REFUSAL_COPY.notImage));
    expect(view.gameplay().pendingAttachments).toEqual([]);
  });

  it('keeps the images and refuses the rest when a drop mixes images and other files', async () => {
    const warn = vi.spyOn(toast, 'warning');
    const view = setup();
    const box = await zone();
    await act(async () => {
      fireEvent.drop(box, { dataTransfer: dragOf([fakeImageFile('100x100'), new File(['x'], 'a.txt', { type: 'text/plain' })]) });
    });
    await waitFor(() => expect(view.gameplay().pendingAttachments).toHaveLength(1));
    expect(warn).toHaveBeenCalledWith(ATTACH_REFUSAL_COPY.notImage);
  });

  it('keeps the images of two pastes that arrive while the first is still encoding', async () => {
    const view = setup();
    const box = await zone();
    await act(async () => {
      fireEvent.paste(box, { clipboardData: clipboard([fakeImageFile('1x1')]) });
      fireEvent.paste(box, { clipboardData: clipboard([fakeImageFile('2x2')]) });
    });
    await waitFor(() => expect(view.gameplay().pendingAttachments).toHaveLength(2));
  });

  it('caps pending images at four across a picked set, a paste and a drop', async () => {
    const warn = vi.spyOn(toast, 'warning');
    const view = setup();
    const box = await zone();
    await pick(fakeImageFile('1x1'), fakeImageFile('2x2'), fakeImageFile('3x3'));
    await waitFor(() => expect(view.gameplay().pendingAttachments).toHaveLength(3));
    await act(async () => { fireEvent.paste(box, { clipboardData: clipboard([fakeImageFile('4x4')]) }); });
    await waitFor(() => expect(view.gameplay().pendingAttachments).toHaveLength(4));
    await act(async () => { fireEvent.drop(box, { dataTransfer: dragOf([fakeImageFile('5x5')]) }); });
    await waitFor(() => expect(warn).toHaveBeenCalledWith(ATTACH_REFUSAL_COPY.limit));
    expect(view.gameplay().pendingAttachments.map((a) => decodedFake(a.dataUrl).size)).toEqual(['1x1', '2x2', '3x3', '4x4']);
  });
});

describe('paste and drop with Image Attachments off', () => {
  it('adds nothing, and leaves the drop and the paste to the browser', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, seed: started });
    await screen.findByTestId('action-input-wrap');
    const box = dropZone();
    expect(fireEvent.paste(box, { clipboardData: clipboard([fakeImageFile('800x600')]) })).toBe(true);
    expect(fireEvent.drop(box, { dataTransfer: dragOf([fakeImageFile('800x600')]) })).toBe(true);
    expect(view.gameplay().pendingAttachments).toEqual([]);
  });
});

describe('the images a past action carried', () => {
  const seed = (g: Gameplay) => g.setActionAttachments({ t2: [image('sketch'), image('map')] });

  it('show under the action on its Pages turn, and a click opens the image viewer', async () => {
    renderMiddlePanel({}, { turns: TURNS, page: 2, seed });
    const line = await screen.findByTestId('action-line');
    fireEvent.click(within(line).getByRole('button', { name: 'View attached image 2' }));
    const viewer = await screen.findByRole('dialog');
    expect(within(viewer).getByRole('img', { name: 'Attached image' }).getAttribute('src')).toBe(image('map').dataUrl);
  });

  it('show nothing on a turn that carried none', async () => {
    renderMiddlePanel({}, { turns: TURNS, page: 3, seed });
    await screen.findByTestId('action-line');
    expect(screen.queryByTestId('attachment-thumbs')).toBeNull();
  });

  describe('in Chat', () => {
    let restore: () => void;
    beforeAll(() => { restore = stubChatLayout(); });
    afterAll(() => restore());

    it('show under the action bubble of their own turn only', async () => {
      renderMiddlePanel({}, { turns: TURNS, seed, settings: (s) => s.setNarrationLayout('chat') });
      const turns = await screen.findAllByRole('article');
      expect(within(turns[1]).getAllByRole('button', { name: /^View attached image/ })).toHaveLength(2);
      expect(within(turns[2]).queryByTestId('attachment-thumbs')).toBeNull();
    });
  });
});
