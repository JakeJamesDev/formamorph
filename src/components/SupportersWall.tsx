import { useEffect, useState, type ReactNode } from 'react';
import { PATREON_PAGE_URL } from '@/components/PatreonSection';
import { SupporterBadge } from '@/components/SupporterBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/typography';
import { SUPPORTER_NAME_STYLES } from '@/lib/supporterFlair';
import { useTierName } from '@/lib/tierNames';
import { cn } from '@/lib/utils';
import { PatreonService, type Supporter } from '@/services/PatreonService';
import type { SupporterTier } from '@/types';

/** The line that thanks the people on the wall. Each host places it. */
export const SUPPORTERS_THANKS = "Our Supporters help fund Formamorph's development. Thank you!";

type State =
  | { status: 'loading' }
  | { status: 'ready'; supporters: Supporter[] }
  | { status: 'failed'; error: string };

/** The sections in display order. The server sends the rows already sorted; the wall only splits them. */
const SECTIONS: SupporterTier[] = ['supporter_top', 'supporter_plus', 'supporter'];

interface SupportersWallProps {
  /** Draws one name, so the host decides what selecting it does. */
  renderName: (supporter: Supporter, className: string) => ReactNode;
  /** Where the rows come from. A dev route swaps in a canned wall. */
  load?: () => Promise<Supporter[]>;
}

/**
 * The Supporters wall: every linked supporter who keeps the flair on.
 *
 * It loads when it mounts and keeps nothing, so a host that unmounts it reads the wall again next time.
 * It imports no context, because the account site renders it too.
 */
export function SupportersWall({ renderName, load = PatreonService.getSupporters }: SupportersWallProps) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const tierNameOf = useTierName();

  useEffect(() => {
    let canceled = false;
    load()
      .then((supporters) => { if (!canceled) setState({ status: 'ready', supporters }); })
      .catch((error: unknown) => {
        if (!canceled) setState({ status: 'failed', error: error instanceof Error ? error.message : String(error) });
      });
    return () => { canceled = true; };
  }, [attempt, load]);

  if (state.status === 'loading') {
    return <Hint>Loading supporters…</Hint>;
  }

  if (state.status === 'failed') {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-label text-destructive">{state.error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((current) => current + 1);
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (state.supporters.length === 0) {
    return (
      <p className="text-body text-muted-foreground">
        No supporters are listed yet.{' '}
        <a
          href={PATREON_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Become a Supporter
        </a>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {SECTIONS.map((tier) => {
        const rows = state.supporters.filter((row) => row.tier === tier);
        if (rows.length === 0) return null;

        return (
          <section key={tier} aria-labelledby={`supporters-${tier}`} className="space-y-3">
            <h2 id={`supporters-${tier}`} className="text-title font-semibold">{tierNameOf(tier)}</h2>
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    username={row.username}
                    avatarUrl={row.avatarUrl}
                    supporter={{ tier: row.tier, since: row.since }}
                    size="md"
                  />
                  {renderName(row, cn('truncate rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', SUPPORTER_NAME_STYLES[row.tier]))}
                  <SupporterBadge tier={row.tier} since={row.since} beatKey={row.id} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
