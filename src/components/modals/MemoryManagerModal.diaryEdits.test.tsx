import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatMessage } from '@/types';
import type { TurnTextEdits } from '@/lib/turnTextEdits';
import { diaryTurn } from '@/test/diaryTurns';
import { MemoryManagerModal } from './MemoryManagerModal';

const HISTORY: ChatMessage[] = [
  ...diaryTurn('t1', { summary: 'Bram refused to explain the console.', diaries: { Bram: 'I gave her nothing.', Wick: 'She is clever.' } }),
  ...diaryTurn('t2', { summary: 'Sable slept.', diaries: { bram: 'nothing notable' } }),
];

// The layer lives in a store the mocked context subscribes to, so each write re-renders the window as the app does.
const store = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const s = {
    layer: {} as TurnTextEdits,
    setLayer: (update: (prev: TurnTextEdits) => TurnTextEdits) => {
      s.layer = update(s.layer);
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
  return s;
});

vi.mock('@/contexts/GameplayContext', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useGameplay: () => ({
      fullMessageHistory: HISTORY,
      memoryPins: {}, setMemoryPins: vi.fn(),
      milestoneSelection: undefined,
      turnTextEdits: useSyncExternalStore(store.subscribe, () => store.layer),
      setTurnTextEdits: store.setLayer,
      memoryNotes: [], setMemoryNotes: vi.fn(),
      gameTime: 0, calendar: undefined,
      contextMemoryIds: [], rehydratedMemoryIds: [],
    }),
  };
});
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ memoryDigests: true, narrationVerbatimTurns: 0, aiClock: false, characterDiaries: true }),
}));
vi.mock('@/components/HelpButton', () => ({ HelpButton: () => null }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));

beforeEach(() => { store.layer = {}; });
afterEach(cleanup);

type Regenerate = (turnId: string, name: string, signal: AbortSignal) => Promise<string | null | undefined>;
const open = (props: { initialDiary?: string; onRegenerateDiary?: Regenerate; onRegenerate?: (id: string, s: AbortSignal) => Promise<string | null | undefined> } = {}) =>
  render(<MemoryManagerModal isOpen onOpenChange={() => {}} initialDiary="Bram" {...props} />);
const entries = () => [...document.querySelectorAll<HTMLElement>('[data-diary-entry]')];
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const rewrite = () => button('Have Bram Write This Entry Again');

describe('changing a diary entry in Memories', () => {
  it('edits the AI entry under the name stored on the turn, shows Edited and the original, and reverts', async () => {
    const user = userEvent.setup();
    open();
    await user.click(button('Edit This Entry'));
    const box = screen.getByRole('textbox');
    expect((box as HTMLTextAreaElement).value).toBe('I gave her nothing.');
    await user.clear(box);
    await user.type(box, 'I told her about the console.');
    await user.click(button('Save'));
    expect(store.layer).toEqual({ t1: { diaries: { Bram: { text: 'I told her about the console.', source: 'player' } } } });
    expect(entries()[0].textContent).toContain('Edited');
    expect(entries()[0].textContent).toContain('Originally: I gave her nothing.');
    await user.click(button('Revert to the Original'));
    expect(store.layer).toEqual({});
  });

  it('edits a quiet entry from an empty box into a real entry', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('checkbox', { name: 'Show Hidden Entries' }));
    await user.click(within(entries()[1]).getByRole('button', { name: 'Edit This Entry' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    await user.type(screen.getByRole('textbox'), 'She stayed. I let her.');
    await user.click(button('Save'));
    expect(store.layer.t2?.diaries?.bram).toEqual({ text: 'She stayed. I let her.', source: 'player' });
    expect(screen.getByText('2 entries')).toBeTruthy();
  });

  it('deletes an entry, lists it dimmed under Show Hidden Entries, and restores it', async () => {
    const user = userEvent.setup();
    open();
    await user.click(button('Delete This Entry'));
    expect(store.layer).toEqual({ t1: { diaries: { Bram: { source: 'player', deleted: true } } } });
    expect(entries()).toHaveLength(0);
    expect(screen.getByText('0 entries · 2 hidden')).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: 'Show Hidden Entries' }));
    expect(entries()[0].textContent).toContain('Deleted');
    await user.click(within(entries()[0]).getByRole('button', { name: 'Restore This Entry' }));
    expect(store.layer).toEqual({});
  });
});

describe('regenerating a diary entry', () => {
  it('previews the new entry; Keep stores it as a kept rewrite', async () => {
    const user = userEvent.setup();
    const onRegenerateDiary = vi.fn<Regenerate>(async () => 'She asked twice. I almost answered.');
    open({ onRegenerateDiary });
    await user.click(rewrite());
    expect(onRegenerateDiary).toHaveBeenCalledWith('t1', 'Bram', expect.any(AbortSignal));
    expect(screen.getByText('She asked twice. I almost answered.')).toBeTruthy();
    expect(store.layer).toEqual({});
    await user.click(button('Keep'));
    expect(store.layer).toEqual({ t1: { diaries: { Bram: { text: 'She asked twice. I almost answered.', source: 'ai' } } } });
    expect(entries()[0].textContent).toContain('Rewritten');
  });

  it('Discard closes the preview and writes nothing', async () => {
    const user = userEvent.setup();
    open({ onRegenerateDiary: async () => 'Another take.' });
    await user.click(rewrite());
    await user.click(button('Discard'));
    expect(screen.queryByText('Another take.')).toBeNull();
    expect(store.layer).toEqual({});
  });

  it('Cancel aborts a waiting request and writes nothing', async () => {
    const user = userEvent.setup();
    let captured: AbortSignal | undefined;
    open({
      onRegenerateDiary: (_t, _n, signal) => {
        captured = signal;
        return new Promise((resolve) => signal.addEventListener('abort', () => resolve(undefined)));
      },
    });
    await user.click(rewrite());
    expect(rewrite().disabled).toBe(true);
    await user.click(button('Cancel Rewrite'));
    expect(captured?.aborted).toBe(true);
    expect(rewrite().disabled).toBe(false);
    expect(store.layer).toEqual({});
  });

  it('keeps every control in its slot while a rewrite runs, after an edit, and after a delete', async () => {
    const user = userEvent.setup();
    open({ onRegenerateDiary: () => new Promise(() => {}) });
    // Each slot is a button or a spacer; a slot's index is its place in the row.
    const slots = () => [...(entries()[0].querySelector('button[aria-label="Edit This Entry"]')?.parentElement?.children ?? [])]
      .map((el) => el.getAttribute('aria-label') ?? (el.tagName === 'BUTTON' ? '?' : 'slot'));
    expect(slots()).toEqual(['slot', 'Edit This Entry', 'slot', 'Have Bram Write This Entry Again', 'Delete This Entry']);
    await user.click(rewrite());
    expect(slots()).toEqual(['slot', 'Edit This Entry', 'Cancel Rewrite', 'Have Bram Write This Entry Again', 'Delete This Entry']);
    await user.click(button('Cancel Rewrite'));
    await user.click(button('Edit This Entry'));
    await user.type(screen.getByRole('textbox'), ' Twice.');
    await user.click(button('Save'));
    expect(slots()).toEqual(['Revert to the Original', 'Edit This Entry', 'slot', 'Have Bram Write This Entry Again', 'Delete This Entry']);
    await user.click(screen.getByRole('checkbox', { name: 'Show Hidden Entries' }));
    await user.click(within(entries()[0]).getByRole('button', { name: 'Delete This Entry' }));
    const deleted = [...(entries()[0].querySelector('button[aria-label="Restore This Entry"]')?.parentElement?.children ?? [])];
    expect(deleted.map((el) => el.getAttribute('aria-label') ?? 'slot')).toEqual(['slot', 'slot', 'slot', 'slot', 'Restore This Entry']);
  });

  it('waits while a memory regenerate is pending elsewhere in the window', async () => {
    const user = userEvent.setup();
    open({ initialDiary: undefined, onRegenerate: () => new Promise(() => {}), onRegenerateDiary: async () => 'x' });
    await user.click(screen.getAllByRole('button', { name: 'Have the Story Write This Memory Again' })[0]);
    await user.click(screen.getByRole('tab', { name: "Bram's Diary" }));
    expect(rewrite().disabled).toBe(true);
  });
});

describe('Reset All My Changes', () => {
  beforeEach(() => {
    store.layer = {
      t1: { memory: { text: 'Mine.', source: 'player' }, diaries: { Bram: { text: 'Fixed.', source: 'player' }, Wick: { source: 'player', deleted: true } } },
      t2: { diaries: { bram: { text: 'Also fixed.', source: 'player' } } },
    };
  });

  it('on a diary, resets only that diary, every spelling of it', async () => {
    const user = userEvent.setup();
    open();
    await user.click(button('Reset All My Changes'));
    await user.click(screen.getByRole('button', { name: /^(Reset|Confirm|Continue)$/ }));
    expect(store.layer).toEqual({ t1: { memory: { text: 'Mine.', source: 'player' }, diaries: { Wick: { source: 'player', deleted: true } } } });
  });

  it('on Story, resets only the memories', async () => {
    const user = userEvent.setup();
    open({ initialDiary: undefined });
    await user.click(button('Reset All My Changes'));
    await user.click(screen.getByRole('button', { name: /^(Reset|Confirm|Continue)$/ }));
    expect(store.layer).toEqual({
      t1: { diaries: { Bram: { text: 'Fixed.', source: 'player' }, Wick: { source: 'player', deleted: true } } },
      t2: { diaries: { bram: { text: 'Also fixed.', source: 'player' } } },
    });
  });
});
