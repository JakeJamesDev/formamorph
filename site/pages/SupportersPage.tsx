import { useEffect, useState } from 'react';
import { SupporterBadge } from '@/components/SupporterBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { PATREON_PAGE_URL } from '@/components/PatreonSection';
import {
  SUPPORTER_LABELS,
  SUPPORTER_NAME_STYLES,
} from '@/lib/supporterFlair';
import type { SupporterTier } from '@/types';
import { PatreonService, type Supporter } from '@/services/PatreonService';
import { cn } from '@/lib/utils';
import { SiteLayout } from '../components/SiteLayout';

type State =
  | { status: 'loading' }
  | { status: 'ready'; supporters: Supporter[] }
  | { status: 'failed'; error: string };

/** The sections in display order. The server sends the rows already sorted; the page only splits them. */
const SECTIONS: SupporterTier[] = ['supporter_plus', 'supporter'];

function SupporterRow({ supporter }: { supporter: Supporter }) {
  const flair = { tier: supporter.tier, since: supporter.since };

  return (
    <li className="flex items-center gap-3 min-w-0">
      <UserAvatar username={supporter.username} avatarUrl={supporter.avatarUrl} supporter={flair} size="md" />
      <a
        href={`/u/${encodeURIComponent(supporter.username)}`}
        className={cn('truncate rounded-sm underline-offset-2 hover:underline', SUPPORTER_NAME_STYLES[supporter.tier])}
      >
        {supporter.username}
      </a>
      <SupporterBadge tier={supporter.tier} since={supporter.since} />
    </li>
  );
}

/**
 * The Supporters wall at `formamorph.ai/supporters`: every linked supporter who keeps the flair on.
 *
 * Open to anyone. The server decides who is listed and in what order, so the page keeps the order it
 * receives and only splits the rows into the two tier sections.
 */
export function SupportersPage() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    PatreonService.getSupporters()
      .then((supporters) => { if (!cancelled) setState({ status: 'ready', supporters }); })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'failed', error: (error as Error).message });
      });

    return () => { cancelled = true; };
  }, []);

  const supporters = state.status === 'ready' ? state.supporters : [];

  return (
    <SiteLayout
      title="Supporters"
      subtitle="People who back Formamorph on Patreon. Thank you."
      width="page"
    >
      {state.status === 'loading' && <p className="text-helper text-muted-foreground">Loading the Supporters wall…</p>}

      {state.status === 'failed' && <p role="alert" className="text-label text-destructive">{state.error}</p>}

      {state.status === 'ready' && supporters.length === 0 && (
        <p className="text-body text-muted-foreground">
          No supporters are listed yet.{' '}
          <a
            href={PATREON_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Become a Supporter
          </a>
        </p>
      )}

      <div className="space-y-6">
        {SECTIONS.map((tier) => {
          const rows = supporters.filter((row) => row.tier === tier);
          if (rows.length === 0) return null;

          return (
            <section key={tier} aria-labelledby={`supporters-${tier}`} className="space-y-3">
              <h2 id={`supporters-${tier}`} className="text-title font-semibold">{SUPPORTER_LABELS[tier]}</h2>
              <ul className="space-y-3">
                {rows.map((row) => <SupporterRow key={row.id} supporter={row} />)}
              </ul>
            </section>
          );
        })}
      </div>
    </SiteLayout>
  );
}
