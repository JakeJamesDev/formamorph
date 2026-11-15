import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MarkdownRenderer, type RemarkPlugin } from '@/components/game/MarkdownRenderer';
import { MentionCardsProvider, MentionTurn, cardTriggers } from '@/components/game/MentionCards';
import type { PlayerViewEntity } from '@/lib/formaquestion/playerView';
import { isContributeAsked, markContributeAsked } from '@/lib/firstTimeFlowStore';
import type { Contributor } from './correctionContribution';
import { remarkMentionLinks } from './mentionLinks';
import { speakerColors } from './speakerPalette';
import { useCorrectionContribution } from './useContributeAsk';

// The first correction asks Contribute Corrections once per account (Q64, Q69), through the real mention card.

const LINE = 'Rook lifts one hand without standing.';
const LINKS: RemarkPlugin = [remarkMentionLinks, { source: { text: LINE, mentions: [{ start: 0, end: 4, entityId: 'rook' }] } }];
const row = (id: string, name: string): PlayerViewEntity => ({ kind: 'entity', id, name, description: '' });
const ROWS = new Map([row('rook', 'Rook'), row('wren', 'Wren')].map((r) => [r.id, r]));
const COLORS = speakerColors([{ id: 'rook' }, { id: 'wren' }]);

const READY: Contributor = { access: 'ready', accountId: 'acct-a' };

function Game({ contributor, optedIn = null, send }: {
  contributor: Contributor; optedIn?: string | null; send: (account: string, turnId: string) => void;
}) {
  const [account, setAccount] = useState(optedIn);
  const { corrected, asks, answerContribute } = useCorrectionContribution(account, setAccount, contributor, send);
  return (
    <MentionCardsProvider
      colors={COLORS}
      rows={ROWS}
      onCorrect={(correction) => corrected(correction.turnId)}
      askContribute={asks}
      onContributeAnswer={answerContribute}
    >
      <span data-testid="opted-in">{account ?? 'none'}</span>
      <MentionTurn turnId="t1">
        <MarkdownRenderer text={LINE} dialogue {...cardTriggers(undefined, LINKS)} />
      </MentionTurn>
    </MentionCardsProvider>
  );
}

const mount = (contributor: Contributor, optedIn: string | null = null) => {
  const send = vi.fn();
  const view = render(<Game contributor={contributor} optedIn={optedIn} send={send} />);
  return { send, view };
};
/** Corrects the mention to Wren through "Wrong character?". */
const correct = (view: ReturnType<typeof render>) => {
  fireEvent.click(view.container.querySelector<HTMLElement>('[data-mention]')!);
  fireEvent.click(screen.getByText('Wrong character?'));
  fireEvent.click(screen.getByText('Wren'));
};
const question = () => screen.queryByTestId('contribute-question');
const card = () => screen.queryByTestId('mention-card');
const optedIn = () => screen.getByTestId('opted-in').textContent;

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('the ask-once question at the first correction', () => {
  it('asks, sends nothing before the answer, and a yes opts in and sends that turn', () => {
    const { send, view } = mount(READY);
    correct(view);
    expect(question()).not.toBeNull();
    expect(screen.getByText(/the whole passage goes to Formamorph/)).toBeTruthy();
    expect(screen.getByText(/Accepted passages are kept/)).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Contribute' }));
    expect(send).toHaveBeenCalledExactlyOnceWith('acct-a', 't1');
    expect(optedIn()).toBe('acct-a');
    expect(isContributeAsked('acct-a')).toBe(true);
    expect(card()).toBeNull();
  });

  it('a no sends nothing, leaves the opt-in off, and never asks again', () => {
    const { send, view } = mount(READY);
    correct(view);
    fireEvent.click(screen.getByRole('button', { name: 'No Thanks' }));
    expect([optedIn(), isContributeAsked('acct-a'), card()]).toEqual(['none', true, null]);
    correct(view);
    expect(question()).toBeNull();
    expect(card()).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('closing the card unanswered counts as no (Q69)', () => {
    const { send, view } = mount(READY);
    correct(view);
    fireEvent.keyDown(question()!, { key: 'Escape' });
    expect(card()).toBeNull();
    expect([optedIn(), isContributeAsked('acct-a')]).toEqual(['none', true]);
    correct(view);
    expect(question()).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('does not ask an account that opted in, and sends each correction', () => {
    const { send, view } = mount(READY, 'acct-a');
    correct(view);
    expect(question()).toBeNull();
    expect(send).toHaveBeenCalledExactlyOnceWith('acct-a', 't1');
  });

  it('asks an account another account on the device already answered for', () => {
    markContributeAsked('acct-b');
    const { view } = mount(READY, 'acct-b');
    correct(view);
    expect(question()).not.toBeNull();
  });

  it('never asks or sends without the 18+ confirmation or signed out', () => {
    for (const contributor of [{ access: 'unattested', accountId: 'acct-a' }, { access: 'signedOut', accountId: null }] as Contributor[]) {
      const { send, view } = mount(contributor);
      correct(view);
      expect(question()).toBeNull();
      expect(send).not.toHaveBeenCalled();
      expect(isContributeAsked('acct-a')).toBe(false);
      view.unmount();
    }
  });
});
