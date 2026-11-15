import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { CharacterMentionsState } from '@/lib/coref/characterMentions';
import type { CharacterMentionsModel } from '@/contexts/settingsDefaults';

const fake = vi.hoisted(() => ({
  state: { status: 'off', progress: null, error: null, model: null, version: null } as CharacterMentionsState,
  plannedSize: vi.fn(async () => 143 * 1048576 as number | null),
  retry: vi.fn(),
  forgetProbe: vi.fn(),
}));
vi.mock('@/lib/coref/characterMentionsApp', () => ({
  characterMentions: () => ({ plannedSize: fake.plannedSize, retry: fake.retry, forgetProbe: fake.forgetProbe }),
  useCharacterMentionsState: () => fake.state,
}));

import { CharacterMentionsRows } from './CharacterMentionsRows';

function mount(over: Partial<{ characterMentions: boolean; language: string; model: CharacterMentionsModel; advanced: boolean }> = {}) {
  const setCharacterMentions = vi.fn();
  const setCharacterMentionsModel = vi.fn();
  render(
    <CharacterMentionsRows
      advanced={over.advanced ?? true}
      source={{
        characterMentions: over.characterMentions ?? false, setCharacterMentions,
        characterMentionsModel: over.model ?? 'auto', setCharacterMentionsModel,
        language: over.language ?? 'English',
      }}
    />,
  );
  return { setCharacterMentions, setCharacterMentionsModel, toggle: () => screen.getByRole('checkbox', { name: /Character Mentions/ }) };
}

beforeEach(() => {
  fake.state = { status: 'off', progress: null, error: null, model: null, version: null };
  vi.clearAllMocks();
});

describe('the Character Mentions settings rows', () => {
  it('shows the download size while off', async () => {
    mount();
    expect(await screen.findByText('143 MB download')).toBeTruthy();
    expect(fake.plannedSize).toHaveBeenCalledWith('auto');
  });

  it('disables the toggle with the reason when AI Language is not English', () => {
    const { toggle, setCharacterMentions } = mount({ language: 'French', characterMentions: true });
    expect(toggle().hasAttribute('disabled')).toBe(true);
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Works only when “AI Language” is English')).toBeTruthy();
    fireEvent.click(toggle());
    expect(setCharacterMentions).not.toHaveBeenCalled();
    expect(fake.plannedSize).not.toHaveBeenCalled();
    expect(screen.queryByRole('radiogroup', { name: 'Mentions Model' })).toBeNull();
  });

  it('shows download progress in MB', () => {
    fake.state = { ...fake.state, status: 'downloading', progress: { loaded: 50 * 1048576, total: 143 * 1048576 } };
    mount({ characterMentions: true });
    expect(screen.getByText('50 / 143 MB')).toBeTruthy();
  });

  it('shows the error row, and Retry runs the download again', () => {
    fake.state = { ...fake.state, status: 'error', error: 'A downloaded file did not match its checksum' };
    mount({ characterMentions: true });
    expect(screen.getByText(/Model download failed: A downloaded file did not match its checksum/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(fake.retry).toHaveBeenCalled();
  });

  it('offers the model choice in advanced mode only, and picking Auto again forgets the probe', async () => {
    const { setCharacterMentionsModel } = mount({ model: 'big' });
    fireEvent.click(screen.getByRole('radio', { name: /Auto/ }));
    expect(fake.forgetProbe).toHaveBeenCalled();
    expect(setCharacterMentionsModel).toHaveBeenCalledWith('auto');
    await waitFor(() => expect(fake.plannedSize).toHaveBeenCalled());
  });

  it('hides the model choice in simple mode', () => {
    mount({ advanced: false });
    expect(screen.queryByText('Mentions Model')).toBeNull();
  });
});
