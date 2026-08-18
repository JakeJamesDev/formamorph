import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { benchEditorWorld, clickFlask, clickOpenBench, renderWorldEditorBench } from '@/test/worldEditorBench';

/**
 * Guards the Bench's three chromes through the real editor: the flask's quick-triage popover, the panel
 * embedded in the editor's list panel, and the panel docked beside it.
 *
 * What these are about is which surface an author is looking at after a click, and what the editor still
 * offers them while it is open — none of which any unit test of the Bench's own pieces can see.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
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

/** One unambiguous defect naming one entity, so the list has a row to act on and an item to land on. */
const WORLD = benchEditorWorld({
  entities: [{
    id: 'e1', name: 'Maren', aliases: ['the visitor'], locations: ['harbor'],
    playerDescription: 'A trader.', aiDescription: 'Trades salt and rope.',
  }],
});

/** A world the rules have nothing to say about — the fixture's own base, defect-free. */
const CLEAN_WORLD = benchEditorWorld({});

const setup = () => renderWorldEditorBench(WORLD, 'advanced');

const flask = () => screen.getByRole('button', { name: /^Test Bench/ });
/** The full panel is showing when its own chrome is: the popover has neither control. */
const benchPanelShown = () => screen.queryByRole('button', { name: 'Close Test Bench' }) !== null;
/** The editor's own list panel is showing when its tab strip is. */
const editorTabsShown = () => screen.queryByRole('tab', { name: 'Entities' }) !== null;
const popoverShown = () => screen.queryByRole('button', { name: 'Open Test Bench' }) !== null;
/** The mobile sheet, whose open/closed is read off it: vaul keeps its content mounted for the exit
 *  animation, and jsdom runs no animations to finish. */
const sheet = () => screen.getByRole('dialog', { name: 'Test Bench' });

/** Report mobile to `useIsMobile`, which reads the width once and then the media query. */
const realMatchMedia = window.matchMedia;
const realWidth = window.innerWidth;
const asMobile = () => {
  window.innerWidth = 400;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width: 767px'),
    media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  window.matchMedia = realMatchMedia;
  window.innerWidth = realWidth;
});

describe('WorldEditor — the Bench Popover', () => {
  it('is what the flask opens first, carrying the findings', async () => {
    setup();
    await clickFlask();

    expect(await screen.findByRole('button', { name: 'Fix' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maren' })).toBeInTheDocument();
    // A couple of findings must not have cost the panel: no Bench chrome, and the editor list is untouched.
    expect(benchPanelShown()).toBe(false);
    expect(editorTabsShown()).toBe(true);
  });

  it('reads as pressed while it is open, and unpressed once it is closed', async () => {
    setup();
    await clickFlask();
    expect(flask()).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(flask());
    expect(flask()).toHaveAttribute('aria-pressed', 'false');
    expect(popoverShown()).toBe(false);
  });

  it('stays open when a finding lands the editor on its item', async () => {
    setup();
    await clickFlask();
    fireEvent.click(await screen.findByRole('button', { name: 'Maren' }));

    // The entity opened in the detail panel, and the list is still there to work down.
    expect(await screen.findByText('Player-Facing Description')).toBeInTheDocument();
    expect(popoverShown()).toBe(true);
  });

  it('quiets the badge on the way out, the same as closing the panel does', async () => {
    setup();
    await waitFor(() => expect(flask()).toHaveAccessibleName('Test Bench, 1 new finding'));

    await clickFlask();
    fireEvent.click(flask());

    // Seen, so the badge drops to its muted total: a still badge means nothing has changed since they looked.
    expect(flask()).toHaveAccessibleName('Test Bench, 1 finding');
  });

  it('says a clean world is verified rather than empty', async () => {
    renderWorldEditorBench(CLEAN_WORLD, 'advanced');
    await clickFlask();

    expect(await screen.findByText('No Problems Found')).toBeInTheDocument();
    expect(screen.getByText(/rules checked$/)).toBeInTheDocument();
  });
});

describe('WorldEditor — where the full Bench sits', () => {
  it('opens embedded, taking the editor list and leaving the detail panel live', async () => {
    setup();
    await clickOpenBench();

    expect(benchPanelShown()).toBe(true);
    expect(editorTabsShown()).toBe(false);
    // The Bench replaced the list, not the editor: its header and footer are still reachable mid-triage.
    expect(screen.getByRole('button', { name: 'Find and replace' })).toBeInTheDocument();

    // And the detail panel beside it is what a finding's item opens into.
    fireEvent.click(await screen.findByRole('button', { name: 'Maren' }));
    expect(await screen.findByText('Player-Facing Description')).toBeInTheDocument();
    expect(benchPanelShown()).toBe(true);
  });

  it('moves to the dock, giving the editor list back', async () => {
    setup();
    await clickOpenBench();
    fireEvent.click(screen.getByRole('button', { name: 'Pop Out' }));

    // The Bench is a third panel again, beside the editor's own two.
    expect(document.querySelector('[data-panel-id="editor-bench"]')).not.toBeNull();
    expect(benchPanelShown()).toBe(true);
    expect(editorTabsShown()).toBe(true);
    // The move works in both directions, so the docked Bench offers the way back.
    expect(screen.getByRole('button', { name: 'Embed in Editor' })).toBeInTheDocument();
  });

  it('reopens where the author last left it, in the next session and the next world', async () => {
    setup();
    await clickOpenBench();
    fireEvent.click(screen.getByRole('button', { name: 'Pop Out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close Test Bench' }));

    // A fresh editor over a *different* world: the placement is how this author works, not something one
    // world owns, so a per-world memory would be the wrong feature and would fail here.
    cleanup();
    renderWorldEditorBench({ ...WORLD, id: 'w2' }, 'advanced');
    await clickOpenBench();

    expect(editorTabsShown()).toBe(true);
    expect(screen.getByRole('button', { name: 'Embed in Editor' })).toBeInTheDocument();
  });

  it('closes on the flask, whichever surface is open', async () => {
    setup();
    await clickOpenBench();
    expect(benchPanelShown()).toBe(true);

    fireEvent.click(flask());
    expect(benchPanelShown()).toBe(false);
    // One button for the feature: closing the panel must not drop straight back into the popover.
    expect(popoverShown()).toBe(false);
    expect(editorTabsShown()).toBe(true);
  });
});

describe('WorldEditor — the Bench on mobile', () => {
  it('keeps the popover and its badge while a finding lands on its item', async () => {
    asMobile();
    setup();
    await waitFor(() => expect(flask()).toHaveAccessibleName('Test Bench, 1 new finding'));
    await clickFlask();
    fireEvent.click(await screen.findByRole('button', { name: 'Maren' }));

    // The popover covers nothing, so navigation doesn't close it — and a list still on screen is a list the
    // author has not finished with, so nothing about it is marked shown yet.
    expect(popoverShown()).toBe(true);
    expect(flask()).toHaveAccessibleName('Test Bench, 1 new finding');
  });

  it('reaches the sheet through the same popover, and closes it to show an item', async () => {
    asMobile();
    setup();
    await clickFlask();
    // Quick triage first here too — the sheet covers the editor, so a small fix shouldn't need it.
    expect(await screen.findByRole('button', { name: 'Fix' })).toBeInTheDocument();
    expect(benchPanelShown()).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Open Test Bench' }));
    await waitFor(() => expect(benchPanelShown()).toBe(true));
    expect(sheet()).toHaveAttribute('data-state', 'open');
    // Nowhere else for the panel to go, so the sheet carries no placement toggle.
    expect(screen.queryByRole('button', { name: 'Pop Out' })).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: 'Maren' }));
    // The sheet covers the editor, so navigation that stayed under it would be navigation nobody sees.
    await waitFor(() => expect(sheet()).toHaveAttribute('data-state', 'closed'));
    expect(await screen.findByText('Player-Facing Description')).toBeInTheDocument();
  });
});
