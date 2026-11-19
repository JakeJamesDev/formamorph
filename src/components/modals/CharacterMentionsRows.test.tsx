import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { CharacterMentionsState } from '@/lib/coref/characterMentions';
import type { CharacterMentionsModel } from '@/contexts/settingsDefaults';
import type { Contributor } from '@/lib/coref/correctionContribution';

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

const viewer = vi.hoisted(() => ({ contributor: { access: 'signedOut', accountId: null } as Contributor }));
vi.mock('@/lib/coref/useContributeAccess', () => ({ useContributeAccess: () => viewer.contributor }));

import { isContributeAsked } from '@/lib/firstTimeFlowStore';
import { CharacterMentionsRows } from './CharacterMentionsRows';

function mount(over: Partial<{ characterMentions: boolean; language: string; model: CharacterMentionsModel; advanced: boolean; contribute: string | null }> = {}) {
  const setCharacterMentions = vi.fn();
  const setCharacterMentionsModel = vi.fn();
  const setContributeCorrections = vi.fn();
  render(
    <CharacterMentionsRows
      advanced={over.advanced ?? true}
      source={{
        characterMentions: over.characterMentions ?? false, setCharacterMentions,
        characterMentionsModel: over.model ?? 'auto', setCharacterMentionsModel,
        language: over.language ?? 'English',
        contributeCorrections: over.contribute ?? null, setContributeCorrections,
      }}
    />,
  );
  return { setCharacterMentions, setCharacterMentionsModel, setContributeCorrections, toggle: () => screen.getByRole('checkbox', { name: /Character Mentions/ }) };
}

beforeEach(() => {
  fake.state = { status: 'off', progress: null, error: null, model: null, version: null };
  viewer.contributor = { access: 'signedOut', accountId: null };
  localStorage.clear();
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

const ACCOUNT_A: Contributor = { access: 'ready', accountId: 'acct-a' };

describe('the Share Corrections row', () => {
  const contribute = () => screen.queryByRole('checkbox', { name: /Share Corrections/ });
  const click = () => fireEvent.click(screen.getByRole('checkbox', { name: /Share Corrections/ }));

  it('shows only while Character Mentions is on', () => {
    viewer.contributor = ACCOUNT_A;
    mount({ characterMentions: false });
    expect(contribute()).toBeNull();
  });

  it('is off by default, and turning it on records the signed-in account', () => {
    viewer.contributor = ACCOUNT_A;
    const { setContributeCorrections } = mount({ characterMentions: true });
    expect(contribute()?.getAttribute('aria-checked')).toBe('false');
    expect(contribute()?.hasAttribute('disabled')).toBe(false);
    click();
    expect(setContributeCorrections).toHaveBeenCalledWith('acct-a');
  });

  it('reads on for the account that opted in, and turning it off clears it', () => {
    viewer.contributor = ACCOUNT_A;
    const { setContributeCorrections } = mount({ characterMentions: true, contribute: 'acct-a' });
    expect(contribute()?.getAttribute('aria-checked')).toBe('true');
    click();
    expect(setContributeCorrections).toHaveBeenCalledWith(null);
  });

  it('reads off for another account on the device (Q60)', () => {
    viewer.contributor = { access: 'ready', accountId: 'acct-b' };
    mount({ characterMentions: true, contribute: 'acct-a' });
    expect(contribute()?.getAttribute('aria-checked')).toBe('false');
    expect(contribute()?.hasAttribute('disabled')).toBe(false);
  });

  it('says the passage is shared and that accepted ones are kept', () => {
    viewer.contributor = ACCOUNT_A;
    mount({ characterMentions: true });
    expect(screen.getByText('Shares corrected passages; accepted ones are kept')).toBeTruthy();
  });

  it('is hidden for a signed-out player, even when the setting was on (Q64)', () => {
    mount({ characterMentions: true, contribute: 'acct-a' });
    expect(contribute()).toBeNull();
  });

  it('sits under the toggle and the model choice, in that order (Q64)', () => {
    viewer.contributor = ACCOUNT_A;
    mount({ characterMentions: true });
    const order = ['Character Mentions', 'Mentions Model', 'Share Corrections']
      .map((label) => screen.getAllByText(label)[0]);
    order.slice(1).forEach((el, i) => {
      expect(order[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('records a change here as the answer to the ask-once question (Q69)', () => {
    viewer.contributor = ACCOUNT_A;
    mount({ characterMentions: true });
    expect(isContributeAsked('acct-a')).toBe(false);
    click();
    expect(isContributeAsked('acct-a')).toBe(true);
    expect(isContributeAsked('acct-b')).toBe(false);
  });

  it('is disabled with the reason without the 18+ confirmation', () => {
    viewer.contributor = { access: 'unattested', accountId: 'acct-a' };
    mount({ characterMentions: true, contribute: 'acct-a' });
    expect(contribute()?.hasAttribute('disabled')).toBe(true);
    expect(contribute()?.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Confirm you’re 18 or older to contribute')).toBeTruthy();
  });
});
