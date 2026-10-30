import { useEffect, useState } from 'react';
import { PATREON_PAGE_URL } from '@/components/PatreonSection';
import { SUPPORTER_LABELS } from '@/lib/supporterFlair';
import { useMountedRef } from '@/lib/useMountedRef';
import { fetchHostedAllowance, type HostedAllowance } from '@/services/HostedStateService';

/** `undefined` while the read is out, `null` when it failed. */
type Reading = HostedAllowance | null | undefined;

/** The reset moment as a UTC calendar date, since the server resets at 00:00 UTC. */
const resetDate = (resetAt: string | null): string | null => {
  const date = resetAt ? new Date(resetAt) : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
};

function PatreonLink({ children }: { children: string }) {
  return (
    <a
      href={PATREON_PAGE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-label text-primary underline underline-offset-2"
    >
      {children}
    </a>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Figures({ reading, reset }: { reading: HostedAllowance; reset: string | null }) {
  return (
    <dl className="space-y-1 text-body">
      {reading.tier && <Row label="Tier" value={SUPPORTER_LABELS[reading.tier]} />}
      {reading.percentUsed !== null && <Row label="Used" value={`${reading.percentUsed}%`} />}
      {reading.turnsLeft !== null && <Row label="Turns left" value={`About ${reading.turnsLeft}`} />}
      {reset && <Row label="Resets" value={reset} />}
    </dl>
  );
}

/**
 * The reader's Formamorph AI allowance: tier, percent used, about how many turns are left and the reset date.
 *
 * It reads the server's hosted state once. It writes nothing and shows no dollar amounts.
 */
export function AllowanceSection() {
  const mounted = useMountedRef();
  const [reading, setReading] = useState<Reading>(undefined);

  useEffect(() => {
    fetchHostedAllowance().then(
      (next) => { if (mounted.current) setReading(next); },
      () => { if (mounted.current) setReading(null); },
    );
  }, [mounted]);

  if (reading === undefined) return <p className="text-helper text-muted-foreground">Reading your allowance…</p>;
  if (reading === null) {
    return <p className="text-helper text-muted-foreground">Couldn’t load your Formamorph AI allowance.</p>;
  }

  const reset = resetDate(reading.resetAt);

  switch (reading.state) {
    case 'locked':
      return (
        <div className="space-y-2">
          <p className="text-helper text-muted-foreground">
            Formamorph AI gives Supporters hosted AI with no key and no setup.
          </p>
          <PatreonLink>Join on Patreon</PatreonLink>
        </div>
      );
    case 'age-gate':
      return <p className="text-helper text-muted-foreground">Confirm your age to use Formamorph AI.</p>;
    case 'paused':
      // A day paused by the spend ceiling keeps the figures; a pause for want of a model has none.
      return (
        <div className="space-y-2">
          <p className="text-helper text-muted-foreground">Formamorph AI is paused. Try again later.</p>
          {reading.percentUsed !== null && <Figures reading={reading} reset={reset} />}
        </div>
      );
    case 'exhausted':
      return (
        <div className="space-y-2">
          <p className="text-helper text-muted-foreground">
            You’ve used this month’s Formamorph AI{reset ? `. It comes back on ${reset}.` : '.'}
          </p>
          <PatreonLink>Upgrade on Patreon</PatreonLink>
        </div>
      );
    default:
      return <Figures reading={reading} reset={reset} />;
  }
}
