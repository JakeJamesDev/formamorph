import { useEffect, useState } from 'react';
import { PATREON_PAGE_URL } from '@/components/PatreonSection';
import { HOSTED_UNCONFIRMED_REASON } from '@/lib/hostedAi/unconfirmedCopy';
import { formatResetTime } from '@/lib/resetTime';
import { useTierName } from '@/lib/tierNames';
import { useMountedRef } from '@/lib/useMountedRef';
import { fetchHostedAllowance, type HostedAllowance } from '@/services/HostedStateService';

/** `undefined` while the read is out, `null` when it failed. */
type Reading = HostedAllowance | null | undefined;

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
  const tierNameOf = useTierName();

  return (
    <dl className="space-y-1 text-body">
      {reading.tier && <Row label="Support" value={tierNameOf(reading.tier)} />}
      {reading.percentUsed !== null && <Row label="Used" value={`${reading.percentUsed}%`} />}
      {reading.turnsLeft !== null && <Row label="Turns left" value={`About ${reading.turnsLeft}`} />}
      {reset && <Row label="Resets" value={reset} />}
    </dl>
  );
}

/**
 * The reader's Formamorph AI allowance: tier, percent used, about how many turns are left and the local reset time.
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

  const reset = formatResetTime(reading.resetAt);

  switch (reading.state) {
    case 'locked':
      return (
        <div className="space-y-2">
          <p className="text-helper text-muted-foreground">
            Formamorph AI thanks Patreon Supporters with hosted AI that needs no key and no setup.
          </p>
          <PatreonLink>Support on Patreon</PatreonLink>
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
    case 'unconfirmed':
      return (
        <div className="space-y-2">
          <p className="text-helper text-muted-foreground">{HOSTED_UNCONFIRMED_REASON}</p>
          <Figures reading={reading} reset={null} />
        </div>
      );
    case 'exhausted':
      return (
        <div className="space-y-2">
          <p className="text-helper text-muted-foreground">
            You’ve used this week’s Formamorph AI allowance{reset ? `. It comes back ${reset}.` : '.'}
          </p>
          <PatreonLink>Support on Patreon</PatreonLink>
        </div>
      );
    default:
      return <Figures reading={reading} reset={reset} />;
  }
}
