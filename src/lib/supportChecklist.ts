import type { PatreonStatus } from '@/services/PatreonService';
import type { SupporterTier } from '@/types';

export type ChecklistStepId = 'signIn' | 'pledge' | 'link' | 'switch';

/** Everything the checklist reads, as plain facts. `patreon` is undefined until a status read answers. */
export interface ChecklistFacts {
  signedIn: boolean;
  /** The 18+ check is answered for this account. */
  attested: boolean;
  patreon: PatreonStatus | undefined;
  /** This device opened the Patreon page from the checklist. */
  patreonOpened: boolean;
  onFormamorphAi: boolean;
}

export interface ChecklistRow {
  id: ChecklistStepId;
  title: string;
  hint: string;
  done: boolean;
}

export type ChecklistAction = 'signIn' | 'openPatreon' | 'link' | 'switch' | 'back';

const linked = ({ patreon }: ChecklistFacts): boolean => patreon?.linked === true;
// Only a link shows a tier, so a pledge counts as done only once the link proves it.
const pledged = ({ patreon }: ChecklistFacts): boolean => patreon?.linked === true && patreon.tier !== null;

export function checklistRows(facts: ChecklistFacts): readonly ChecklistRow[] {
  const signedIn = facts.signedIn && facts.attested;
  return [
    {
      id: 'signIn',
      title: 'Sign In',
      done: signedIn,
      hint: signedIn ? 'You’re signed in and confirmed 18 or older' : 'Sign in and confirm you’re 18 or older',
    },
    {
      id: 'pledge',
      title: 'Pledge on Patreon',
      done: pledged(facts),
      hint: pledged(facts)
        ? 'Your pledge is active'
        : linked(facts) ? 'Patreon shows no pledge on your account yet' : 'Pick a level on the Patreon page',
    },
    {
      id: 'link',
      title: 'Link Patreon',
      done: linked(facts),
      hint: linked(facts) ? 'Your Patreon account is linked' : 'Connect your Patreon account to Formamorph',
    },
    {
      id: 'switch',
      title: 'Switch to Formamorph AI',
      done: facts.onFormamorphAi,
      hint: facts.onFormamorphAi ? 'Formamorph AI is on' : 'Use it for your stories',
    },
  ];
}

/** The first unfinished row's action. A player back from Patreon with no link goes straight to Link Patreon. */
export function checklistAction(facts: ChecklistFacts): ChecklistAction {
  const first = checklistRows(facts).find((row) => !row.done);
  if (!first) return 'back';
  if (first.id === 'signIn') return 'signIn';
  if (first.id === 'pledge') return facts.patreonOpened && !linked(facts) ? 'link' : 'openPatreon';
  if (first.id === 'link') return 'link';
  return 'switch';
}

export const checklistDoneCount = (facts: ChecklistFacts): number => checklistRows(facts).filter((row) => row.done).length;

/** The fire grows with the steps finished, not with the player's tier. */
export function checklistFireTier(doneCount: number): SupporterTier {
  if (doneCount >= 4) return 'supporter_top';
  return doneCount >= 2 ? 'supporter_plus' : 'supporter';
}
