import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/contexts/SettingsContext';
import type { CharacterMentionsState } from '@/lib/coref/characterMentions';

const fake = vi.hoisted(() => ({
  state: { status: 'off', progress: null, error: null, model: null, version: null } as CharacterMentionsState,
  plannedSize: vi.fn(async () => 143 * 1048576 as number | null),
  retry: vi.fn(),
}));
vi.mock('@/lib/coref/characterMentionsApp', () => ({
  characterMentions: () => ({ plannedSize: fake.plannedSize, retry: fake.retry }),
  useCharacterMentionsState: () => fake.state,
}));

import { MentionsStoryCard } from './MentionsStoryCard';

const mount = (accepted: boolean) => {
  const onTurnOn = vi.fn();
  const onNotNow = vi.fn();
  render(<SettingsProvider><MentionsStoryCard accepted={accepted} onTurnOn={onTurnOn} onNotNow={onNotNow} /></SettingsProvider>);
  return { onTurnOn, onNotNow, card: () => screen.getByTestId('mentions-story-card') };
};

beforeEach(() => {
  localStorage.clear();
  fake.state = { status: 'off', progress: null, error: null, model: null, version: null };
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('the Character Mentions card', () => {
  it('states the download size and offers Turn On and Not Now', async () => {
    const { onTurnOn, onNotNow, card } = mount(false);
    expect(await within(card()).findByText(/one-time 143 MB download/)).toBeTruthy();
    fireEvent.click(within(card()).getByRole('button', { name: 'Turn On' }));
    fireEvent.click(within(card()).getByRole('button', { name: 'Not Now' }));
    expect([onTurnOn.mock.calls.length, onNotNow.mock.calls.length]).toEqual([1, 1]);
  });

  it('shows the download bar and no buttons once accepted', () => {
    fake.state = { ...fake.state, status: 'downloading', progress: { loaded: 50 * 1048576, total: 143 * 1048576 } };
    const { card } = mount(true);
    expect(within(card()).getByText('50 / 143 MB')).toBeTruthy();
    expect(within(card()).queryAllByRole('button')).toEqual([]);
  });

  it('shows a failed download with Retry and Not Now', () => {
    fake.state = { ...fake.state, status: 'error', error: 'offline' };
    const { card } = mount(true);
    expect(within(card()).getByText(/Model download failed: offline/)).toBeTruthy();
    fireEvent.click(within(card()).getByRole('button', { name: 'Retry' }));
    expect(fake.retry).toHaveBeenCalledTimes(1);
    expect(within(card()).getByRole('button', { name: 'Not Now' })).toBeTruthy();
  });
});
