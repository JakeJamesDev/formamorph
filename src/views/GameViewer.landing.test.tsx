import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGameViewer } from '@/test/gameViewer';
import { createSurfaceRequester } from '@/test/surfaceRequest';
import { stubReducedMotion } from '@/test/reducedMotion';
import { frames, recordScrolls, rowOf } from '@/test/landing';
import { LANDING_PULSE_CLASS, LANDING_RING_CLASS } from '@/lib/landingPulse';
import type { World } from '@/types';

/** Take Me There landing on the game screen: the row a request names is scrolled to, focused, and pulsed once. */

// The hosted build: the Default preset is the Demo AI, so entering a game raises the gate the tests dismiss.
// Pinned here so a developer's `.env.local` endpoint cannot hide the gate.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('kokoro-js', () => ({ KokoroTTS: { from_pretrained: vi.fn() } }));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const WORLD = {
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
  stats: [], locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }], entities: [], traits: [], statUpdates: [],
} as unknown as World;

const ACTION_BOX = 'gameViewer#action-box';
const PAGER = 'gameViewer#pager';
const STORY_FORMAT = 'export#story-format';

let requester: ReturnType<typeof createSurfaceRequester>;
const scrolled = recordScrolls();

const endPulse = (row: HTMLElement) => row.dispatchEvent(
  Object.assign(new Event('animationend', { bubbles: true }), { animationName: LANDING_PULSE_CLASS }),
);

/** Enter the game and dismiss the AI setup gate the default endpoint raises, as a player does. */
async function enterGame() {
  renderGameViewer(WORLD, { children: <requester.Requester /> });
  fireEvent.click(await screen.findByRole('button', { name: 'Keep Playing' }));
  await waitFor(() => expect(rowOf(ACTION_BOX)).not.toBeNull());
}

beforeEach(() => {
  localStorage.clear();
  requester = createSurfaceRequester();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Take Me There landing on the game screen', () => {
  it('scrolls the action box into view and focuses its field', async () => {
    await enterGame();
    requester.send('gameViewer', 'action-box');
    await waitFor(() => expect(scrolled).toContain(rowOf(ACTION_BOX)));
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/Type your action/));
  });

  it('pulses the row once, and the class leaves when the animation ends', async () => {
    await enterGame();
    requester.send('gameViewer', 'action-box');
    await waitFor(() => expect(rowOf(ACTION_BOX)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true));
    expect(document.querySelectorAll(`.${LANDING_PULSE_CLASS}`)).toHaveLength(1);
    endPulse(rowOf(ACTION_BOX)!);
    expect(rowOf(ACTION_BOX)!.classList.contains(LANDING_PULSE_CLASS)).toBe(false);
  });

  it('draws the still ring without the pulse under reduced motion', async () => {
    stubReducedMotion();
    await enterGame();
    requester.send('gameViewer', 'action-box');
    await waitFor(() => expect(rowOf(ACTION_BOX)!.classList.contains(LANDING_RING_CLASS)).toBe(true));
    expect(rowOf(ACTION_BOX)!.classList.contains(LANDING_PULSE_CLASS)).toBe(false);
  });

  it('lands again on a repeat request for the same target', async () => {
    await enterGame();
    requester.send('gameViewer', 'action-box');
    await waitFor(() => expect(scrolled).toHaveLength(1));
    endPulse(rowOf(ACTION_BOX)!);
    requester.send('gameViewer', 'action-box');
    await waitFor(() => expect(scrolled).toHaveLength(2));
    expect(rowOf(ACTION_BOX)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true);
  });

  it('lands on the pager and focuses its first enabled button', async () => {
    await enterGame();
    requester.send('gameViewer', 'pager');
    await waitFor(() => expect(scrolled).toContain(rowOf(PAGER)));
    expect(rowOf(PAGER)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true);
    // One page: Previous and Next are dead, so the current page's button takes focus.
    expect(document.activeElement).toBe(screen.getByRole('link', { current: 'page' }));
  });

  it('opens the export dialog, then lands on its format buttons', async () => {
    await enterGame();
    requester.send('export', 'story-format');
    await screen.findByText('Export story');
    await waitFor(() => expect(scrolled).toContain(rowOf(STORY_FORMAT)));
    expect(rowOf(STORY_FORMAT)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true);
    expect(rowOf(STORY_FORMAT)!.contains(screen.getByRole('button', { name: 'Markdown (.md)' }))).toBe(true);
  });

  it('leaves the screen as it is, with no error, when the target is not on screen', async () => {
    // Chat has no pager, so the registered target is absent from the DOM.
    localStorage.setItem('FORMAMORPH_narrationLayout', 'chat');
    const errors = vi.spyOn(console, 'error');
    await enterGame();
    expect(rowOf(PAGER)).toBeNull();
    requester.send('gameViewer', 'pager');
    await frames(32);
    expect(scrolled).toEqual([]);
    expect(document.querySelector(`.${LANDING_PULSE_CLASS}`)).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    expect(requester.pending()).toBeNull();
  });

  it('does not land twice for a Settings target the dialog lands itself', async () => {
    await enterGame();
    requester.send('settings.output', 'choices');
    await screen.findByRole('dialog');
    await waitFor(() => expect(document.querySelector(`.${LANDING_PULSE_CLASS}`)).not.toBeNull());
    await frames(4);
    expect(document.querySelectorAll(`.${LANDING_PULSE_CLASS}`)).toHaveLength(1);
    expect(scrolled.filter((el) => el === rowOf('settings.output#choices'))).toHaveLength(1);
  });
});
