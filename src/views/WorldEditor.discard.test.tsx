import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import WorldEditor from './WorldEditor';
import type { World } from '@/types';

/**
 * Guards the "Exit Without Saving" contract end to end, through the real JSX.
 *
 * `GameDataContext.test.tsx` covers `discardChanges` in isolation, but the bug that shipped was the *wiring*:
 * the editor's exit handler closed without ever calling it. These tests fail if that call site disappears,
 * which the isolated ones do not.
 */

// jsdom has no matchMedia; SettingsProvider (theme) and useIsMobile (layout) both read it on mount.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

// The editor's import/export path spins up a worker; jsdom has no worker for it to reach.
vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(),
  parseJsonText: vi.fn(),
  terminateWorker: vi.fn(),
}));

const WORLD = {
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [],
} as unknown as World;

/** Loads `WORLD` once on mount and exposes the live context to the test. */
const Harness = ({ children, onReady }: { children?: ReactNode; onReady: (ctx: ReturnType<typeof useGameData>) => void }) => {
  const ctx = useGameData();
  useEffect(() => { ctx.loadWorldData(WORLD); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx);
  return <>{children}</>;
};

/** Renders the editor over a freshly loaded world; returns a getter for the live context. */
const setup = (onClose = vi.fn()) => {
  let ctx!: ReturnType<typeof useGameData>;
  const view = render(
    <SettingsProvider>
      <GameDataProvider>
        <Harness onReady={(c) => { ctx = c; }}>
          <WorldEditor onClose={onClose} embedded backButton />
        </Harness>
      </GameDataProvider>
    </SettingsProvider>,
  );
  return { view, onClose, ctx: () => ctx };
};

/** Rename the world through the Overview tab's name field — a plain, always-present edit. */
const renameTo = (value: string) => {
  const field = screen.getByDisplayValue('Sedge Landing');
  fireEvent.change(field, { target: { value } });
};

/** The header's back arrow, found by its icon — several buttons in the editor are icon-only. */
const backArrow = () => {
  const button = document.querySelector('.lucide-arrow-left')?.closest('button');
  if (!button) throw new Error('back arrow not rendered');
  return button;
};

/** Click the header back arrow, then the given button in the unsaved-changes prompt. The prompt renders
 *  into a portal on a later commit, so the button has to be awaited rather than queried inline. */
const exitVia = async (label: string) => {
  fireEvent.click(backArrow());
  fireEvent.click(await screen.findByRole('button', { name: label }));
};

describe('WorldEditor — exit without saving', () => {
  it('rolls the edit back and closes', async () => {
    const { onClose, ctx } = setup();
    renameTo('Sedge Landing EDITED');
    expect(ctx().isWorldDirty).toBe(true);

    await exitVia('Exit Without Saving');

    // The regression: the editor closed but the edit stayed live in the store.
    expect(ctx().worldOverview.name).toBe('Sedge Landing');
    expect(ctx().isWorldDirty).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the edit when the prompt is cancelled', async () => {
    const { onClose, ctx } = setup();
    renameTo('Sedge Landing EDITED');

    await exitVia('Cancel');

    // Cancel means "I'm still working" — discarding here would destroy the work the prompt exists to protect.
    expect(ctx().worldOverview.name).toBe('Sedge Landing EDITED');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without a prompt when nothing was edited', async () => {
    const { onClose, ctx } = setup();
    expect(ctx().isWorldDirty).toBe(false);

    await act(async () => { fireEvent.click(backArrow()); });

    expect(screen.queryByText('Exit Without Saving')).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('WorldEditor — re-entry after a discard', () => {
  it('shows the saved world again when reopened without a reload', async () => {
    // Path A, the reported bug: MainMenu keeps the world's detail modal open behind the editor, so "Edit
    // World" remounts the editor against the SAME provider — no storage read to launder the stale state.
    let ctx!: ReturnType<typeof useGameData>;
    const onClose = vi.fn();
    const Host = ({ open }: { open: boolean }) => (
      <SettingsProvider>
        <GameDataProvider>
          <Harness onReady={(c) => { ctx = c; }}>
            {open ? <WorldEditor onClose={onClose} embedded backButton /> : null}
          </Harness>
        </GameDataProvider>
      </SettingsProvider>
    );

    const { rerender } = render(<Host open />);
    renameTo('Sedge Landing EDITED');
    await exitVia('Exit Without Saving');

    // Close the editor, then reopen it — the provider (and its state) never unmounts.
    rerender(<Host open={false} />);
    rerender(<Host open />);

    expect(screen.getByDisplayValue('Sedge Landing')).toBeTruthy();
    expect(screen.queryByDisplayValue('Sedge Landing EDITED')).toBeNull();
    expect(ctx.isWorldDirty).toBe(false);
  });

  it('still shows the edit when reopened after cancelling the prompt', async () => {
    // The mirror of the above: a cancelled exit must survive a close/reopen, or "Cancel" would silently
    // behave like "Exit Without Saving" for anyone who left and came back.
    const onClose = vi.fn();
    const Host = ({ open }: { open: boolean }) => (
      <SettingsProvider>
        <GameDataProvider>
          <Harness onReady={() => {}}>
            {open ? <WorldEditor onClose={onClose} embedded backButton /> : null}
          </Harness>
        </GameDataProvider>
      </SettingsProvider>
    );

    const { rerender } = render(<Host open />);
    renameTo('Sedge Landing EDITED');
    await exitVia('Cancel');

    rerender(<Host open={false} />);
    rerender(<Host open />);

    expect(screen.getByDisplayValue('Sedge Landing EDITED')).toBeTruthy();
  });
});

describe('WorldEditor — exit without saving, after a rename rewrote stat code', () => {
  /** A world whose one stat reaches its one placeholder by path, so a rename has code to carry. */
  const CODED = {
    id: 'w2',
    worldOverview: {
      name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
      systemPrompt: '', use3DModel: true, tags: [],
    },
    stats: [{
      id: 's1', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 5, regen: 0,
      code: 'return placeholders.Mood.text.length;',
    }],
    placeholders: [{ id: 'p1', name: 'Mood', values: [{ id: 'v:calm', text: 'calm' }] }],
    locations: [], entities: [], traits: [], statUpdates: [],
  } as unknown as World;

  const CodedHarness = ({ children, onReady }: { children?: ReactNode; onReady: (c: ReturnType<typeof useGameData>) => void }) => {
    const ctx = useGameData();
    useEffect(() => { ctx.loadWorldData(CODED); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
    onReady(ctx);
    return <>{children}</>;
  };

  it('rolls the name and the rewritten code back together', async () => {
    let ctx!: ReturnType<typeof useGameData>;
    const onClose = vi.fn();
    render(
      <SettingsProvider>
        <GameDataProvider>
          <CodedHarness onReady={(c) => { ctx = c; }}>
            <WorldEditor onClose={onClose} embedded backButton />
          </CodedHarness>
        </GameDataProvider>
      </SettingsProvider>,
    );

    // The Placeholders tab is Advanced only, and its panel opens on the row the author picks. A Radix tab
    // switches on the pointer press, not the click jsdom synthesizes after it.
    fireEvent.click(screen.getByText('Advanced'));
    const tab = screen.getAllByRole('tab').find((t) => t.textContent === 'Placeholders')!;
    fireEvent.mouseDown(tab);
    fireEvent.pointerDown(tab, { pointerType: 'mouse', button: 0 });
    fireEvent.click(screen.getAllByText('Mood')[0]);
    // Focus first: the offer takes the name it compares against when the field gains focus, so a change
    // with no focus before it is not a rename at all.
    const field = screen.getByPlaceholderText('e.g. Eye Color');
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: 'Temper' } });
    fireEvent.blur(field);

    fireEvent.click(await screen.findByRole('button', { name: 'Update Code' }));
    expect(ctx.stats[0].code).toBe('return placeholders.Temper.text.length;');

    await exitVia('Exit Without Saving');

    // Both halves of one edit. The rewrite goes through the editor's ordinary write path, so a discard that
    // took back only the name would leave the code naming a placeholder the world no longer has.
    expect(ctx.placeholders[0].name).toBe('Mood');
    expect(ctx.stats[0].code).toBe('return placeholders.Mood.text.length;');
    expect(ctx.isWorldDirty).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });
});
