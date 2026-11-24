import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatMessage } from '@/types';
import type { TurnTextEdits } from '@/lib/turnTextEdits';
import { diaryTurn } from '@/test/diaryTurns';
import { MemoryPanel } from '@/components/game/MemoryPanel';
import { MemoryManagerModal } from './MemoryManagerModal';

const turn = (turnId: string, summary: string, diaries: Record<string, string>, codeDiaries?: Record<string, string[]>) =>
  diaryTurn(turnId, { summary, diaries, ...(codeDiaries ? { codeDiaries } : {}) });

const DIARY_HISTORY = [
  ...turn('t1', 'Sable woke in the white room.', { Wick: 'Made it before the doors sealed.' }),
  ...turn('t2', 'Bram refused to explain the console.', { Bram: 'I gave her nothing.', Wick: 'nothing notable' }),
  ...turn('t3', 'Bram denied the basement.', { Bram: 'She knows about the basement.' }, { Bram: ['My oath grows heavier.'] }),
];

const state = vi.hoisted(() => ({
  history: [] as ChatMessage[],
  textEdits: {} as TurnTextEdits,
  characterDiaries: true,
  isMobile: false,
}));

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => ({
    fullMessageHistory: state.history,
    memoryPins: {}, setMemoryPins: vi.fn(),
    milestoneSelection: undefined,
    turnTextEdits: state.textEdits, setTurnTextEdits: vi.fn(),
    memoryNotes: [], setMemoryNotes: vi.fn(),
    gameTime: 0, calendar: undefined,
    contextMemoryIds: [], rehydratedMemoryIds: [],
  }),
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ memoryDigests: true, narrationVerbatimTurns: 0, aiClock: false, characterDiaries: state.characterDiaries }),
}));
vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: () => state.isMobile }));
vi.mock('@/components/HelpButton', () => ({ HelpButton: () => null }));

afterEach(() => {
  cleanup();
  Object.assign(state, { history: [], textEdits: {}, characterDiaries: true, isMobile: false });
});

const open = (props: { initialDiary?: string } = {}) =>
  render(<MemoryManagerModal isOpen onOpenChange={() => {}} {...props} />);

const sections = () => screen.getByRole('tablist', { name: 'Memory Sections' });
const entryTexts = () => [...document.querySelectorAll('[data-diary-entry]')].map((el) => el.textContent ?? '');

describe('Diaries in the Memories window', () => {
  it('lists Story, then one diary per name in order of first appearance', () => {
    state.history = DIARY_HISTORY;
    open();
    expect(within(sections()).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Story', "Wick's Diary", "Bram's Diary"]);
  });

  it("lists a diary's entries oldest first, each with its turn and that turn's memory", async () => {
    state.history = DIARY_HISTORY;
    open();
    await userEvent.click(screen.getByRole('tab', { name: "Bram's Diary" }));
    const entries = entryTexts();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toContain('Bram refused to explain the console.');
    expect(entries[0]).toContain('I gave her nothing.');
    expect(entries[0]).toContain('Turn 2');
    expect(entries[1]).toContain('Turn 3');
    expect(screen.getByText('2 entries')).toBeTruthy();
  });

  it('shows script lines with a Script badge and no controls', () => {
    state.history = DIARY_HISTORY;
    open({ initialDiary: 'bram' });
    const scripted = [...document.querySelectorAll('[data-diary-entry]')][1] as HTMLElement;
    expect(within(scripted).getByText('Script')).toBeTruthy();
    expect(within(scripted).getByText('My oath grows heavier.')).toBeTruthy();
    expect(within(scripted).queryAllByRole('button')).toHaveLength(0);
  });

  it('hides quiet entries until Show Hidden Entries is on, in place of the filter row', async () => {
    state.history = DIARY_HISTORY;
    open({ initialDiary: 'Wick' });
    expect(screen.queryByRole('button', { name: 'Verbatim' })).toBeNull();
    expect(entryTexts()).toHaveLength(1);
    expect(screen.getByText('1 entry · 1 hidden')).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Hidden Entries' }));
    expect(entryTexts()).toHaveLength(2);
    expect(entryTexts()[1]).toContain('Nothing notable.');
  });

  it("searches only the open diary's entries", async () => {
    state.history = DIARY_HISTORY;
    open({ initialDiary: 'Wick' });
    await userEvent.type(screen.getByPlaceholderText("Search Wick's diary"), 'nothing');
    expect(screen.getByText('No entries match that.')).toBeTruthy();
    await userEvent.clear(screen.getByPlaceholderText("Search Wick's diary"));
    await userEvent.type(screen.getByPlaceholderText("Search Wick's diary"), 'doors');
    expect(entryTexts()).toHaveLength(1);
  });

  it('keeps Add Memory and Reset on Story only', () => {
    state.history = DIARY_HISTORY;
    open({ initialDiary: 'Bram' });
    expect(screen.queryByRole('button', { name: /Add Memory/ })).toBeNull();
    expect((screen.getByRole('button', { name: 'Reset All My Changes' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('reads the entries through the text edit layer', () => {
    state.history = DIARY_HISTORY;
    state.textEdits = {
      t2: { diaries: { Bram: { text: 'I told her everything.', source: 'player' } } },
      t3: { diaries: { Bram: { source: 'player', deleted: true } } },
    };
    open({ initialDiary: 'Bram' });
    expect(entryTexts()).toHaveLength(1);
    expect(entryTexts()[0]).toContain('I told her everything.');
    expect(entryTexts()[0]).toContain('Originally: I gave her nothing.');
  });

  it('with Character Diaries off, shows the diaries and a note on a diary only', async () => {
    state.history = DIARY_HISTORY;
    state.characterDiaries = false;
    open();
    expect(screen.queryByText(/write no new diary entries/)).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: "Wick's Diary" }));
    expect(screen.getByText(/write no new diary entries/)).toBeTruthy();
  });

  it('shows Story alone for a save without diary entries', () => {
    state.history = turn('t1', 'Sable woke.', {});
    state.characterDiaries = false;
    open();
    expect(screen.queryByRole('tablist', { name: 'Memory Sections' })).toBeNull();
    expect(screen.getByText('Sable woke.')).toBeTruthy();
  });

  it('names Show Hidden Entries only while something is hidden', async () => {
    state.history = DIARY_HISTORY;
    state.textEdits = { t1: { diaries: { Wick: { source: 'player', deleted: true } } } };
    open({ initialDiary: 'Wick' });
    expect(screen.getByText(/Every entry here is hidden/)).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Hidden Entries' }));
    expect(entryTexts()).toHaveLength(1);
    state.textEdits = { t1: { diaries: { Wick: { source: 'player', deleted: true } } }, t2: { diaries: { Wick: { source: 'player', deleted: true } } } };
    cleanup();
    open({ initialDiary: 'Wick' });
    expect(screen.getByText('No entries to show.')).toBeTruthy();
  });

  it('opens on Story when the asked-for diary does not exist', () => {
    state.history = DIARY_HISTORY;
    open({ initialDiary: 'Odette' });
    expect(screen.getByRole('tab', { name: 'Story' }).getAttribute('aria-selected')).toBe('true');
  });

  it('opens from a Memories request on its diary, once per request', async () => {
    state.history = DIARY_HISTORY;
    const opened = vi.fn();
    const { rerender } = render(<MemoryPanel memoriesRequest={{ key: 'a', diary: 'Bram' }} onMemoriesOpened={opened} />);
    expect(screen.getByRole('tab', { name: "Bram's Diary" }).getAttribute('aria-selected')).toBe('true');
    expect(opened).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<MemoryPanel memoriesRequest={null} onMemoriesOpened={opened} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<MemoryPanel memoriesRequest={{ key: 'b', diary: 'Wick' }} onMemoriesOpened={opened} />);
    expect(screen.getByRole('tab', { name: "Wick's Diary" }).getAttribute('aria-selected')).toBe('true');
    expect(opened).toHaveBeenCalledTimes(2);
  });

  it('on mobile, lists the same sections in the Sections bar', async () => {
    state.history = DIARY_HISTORY;
    state.isMobile = true;
    open();
    await userEvent.click(screen.getByRole('button', { name: /Sections/ }));
    expect(within(sections()).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Story', "Wick's Diary", "Bram's Diary"]);
    await userEvent.click(screen.getByRole('tab', { name: "Bram's Diary" }));
    expect(entryTexts()).toHaveLength(2);
  });
});
