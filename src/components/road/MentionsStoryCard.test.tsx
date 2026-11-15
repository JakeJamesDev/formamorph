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

const mount = (accepted: boolean, asking = false) => {
  const onTurnOn = vi.fn();
  const onNotNow = vi.fn();
  const onAnswer = vi.fn();
  render(
    <SettingsProvider>
      <MentionsStoryCard accepted={accepted} onTurnOn={onTurnOn} onNotNow={onNotNow} asking={asking} onAnswer={onAnswer} />
    </SettingsProvider>,
  );
  return { onTurnOn, onNotNow, onAnswer, card: () => screen.getByTestId('mentions-story-card') };
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
    // The preview's mentions and Show Me stay; the offer's own actions go.
    // Only Show Me stays; the offer's own actions go.
    expect(within(card()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Show Me']);
  });

  it('shows a failed download with Retry and Not Now', () => {
    fake.state = { ...fake.state, status: 'error', error: 'offline' };
    const { card } = mount(true);
    expect(within(card()).getByText(/Model download failed: offline/)).toBeTruthy();
    fireEvent.click(within(card()).getByRole('button', { name: 'Retry' }));
    expect(fake.retry).toHaveBeenCalledTimes(1);
    expect(within(card()).getByRole('button', { name: 'Not Now' })).toBeTruthy();
  });

  it('keeps the passage out of the card: Show Me in Morphie’s place opens it in a dialog (Q65)', () => {
    const { card } = mount(false);
    expect(within(card()).queryByTestId('mentions-preview')).toBeNull();
    expect(card().querySelector('img')).toBeNull();
    fireEvent.click(within(card()).getByRole('button', { name: 'Show Me' }));
    const dialog = screen.getByRole('dialog', { name: 'Character Mentions' });
    expect(within(dialog).getByTestId('mentions-preview').textContent).toContain('"Then pour mine," you say.');
  });

  it('asks Contribute Corrections under the download once accepted, and passes the answer on', () => {
    fake.state = { ...fake.state, status: 'ready' };
    const { card, onAnswer } = mount(true, true);
    const question = within(card()).getByTestId('contribute-question');
    expect(question.textContent).toMatch(/whole passage goes to Formamorph.*Accepted passages are kept/);
    fireEvent.click(within(question).getByRole('button', { name: 'No Thanks' }));
    fireEvent.click(within(question).getByRole('button', { name: 'Contribute' }));
    expect(onAnswer.mock.calls).toEqual([[false], [true]]);
  });

  it('asks nothing under a failed download, which offers Not Now', () => {
    fake.state = { ...fake.state, status: 'error', error: 'offline' };
    const { card } = mount(true, true);
    expect(within(card()).queryByTestId('contribute-question')).toBeNull();
    expect(within(card()).getByRole('button', { name: 'Not Now' })).toBeTruthy();
  });

  it('asks nothing before Turn On', () => {
    const { card } = mount(false, true);
    expect(within(card()).queryByTestId('contribute-question')).toBeNull();
  });
});
