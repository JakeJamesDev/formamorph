import { useCallback, useState } from 'react';
import { isContributeAsked, markContributeAsked } from '@/lib/firstTimeFlowStore';
import { asksToContribute, contributesNow, type Contributor } from './correctionContribution';

/** The Contribute Corrections question, asked once per account (Q64, Q69). `asks` says whether to ask now;
 *  `answer` records the answer, opts the account in on a yes, and returns the account id on a yes. */
export function useContributeAsk(
  optedInAccount: string | null, setOptedInAccount: (accountId: string | null) => void, contributor: Contributor,
): { asks: boolean; answer: (yes: boolean) => string | null } {
  // The record lives in storage, so an answer re-renders through this count.
  const [, setAnswers] = useState(0);
  const asks = asksToContribute(optedInAccount, contributor, isContributeAsked);
  const { accountId } = contributor;
  const answer = useCallback((yes: boolean) => {
    if (accountId === null) return null;
    markContributeAsked(accountId);
    setAnswers((n) => n + 1);
    if (!yes) return null;
    setOptedInAccount(accountId);
    return accountId;
  }, [accountId, setOptedInAccount]);
  return { asks, answer };
}

/** What the game view hands the mention cards: a correction sends its turn only for an opted-in account, and the
 *  first correction of an account never asked asks, sending the turn only on a yes. `send` sends a turn's
 *  corrections for the given opted-in account. */
export function useCorrectionContribution(
  optedInAccount: string | null, setOptedInAccount: (accountId: string | null) => void, contributor: Contributor,
  send: (optedInAccount: string, turnId: string) => void,
) {
  const { asks, answer } = useContributeAsk(optedInAccount, setOptedInAccount, contributor);
  const corrected = useCallback((turnId: string) => {
    if (optedInAccount !== null && contributesNow(optedInAccount, contributor)) send(optedInAccount, turnId);
  }, [optedInAccount, contributor, send]);
  const answerContribute = useCallback((yes: boolean, turnId: string) => {
    const account = answer(yes);
    if (account !== null) send(account, turnId);
  }, [answer, send]);
  return { corrected, asks, answerContribute };
}
