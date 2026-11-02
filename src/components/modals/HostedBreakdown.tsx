import { useMemo } from 'react';
import { Hint, Meta } from '@/components/ui/typography';
import { rollupBreakdown } from '@/lib/hostedAi/breakdownRollup';

/** Where this week's Formamorph AI use went: seven groups by percent, with a large single prompt named under its group. */
export function HostedBreakdown({ breakdown, threshold }: { breakdown: Record<string, number>; threshold: number | null }) {
  const rollup = useMemo(() => rollupBreakdown(breakdown, threshold), [breakdown, threshold]);

  if (rollup.empty) return <Hint data-hosted-breakdown="empty">Nothing used yet this week</Hint>;

  return (
    <ul className="flex w-full flex-col gap-2" aria-label="Where this week’s use went" data-hosted-breakdown>
      {rollup.groups.map((group) => (
        <li key={group.id} className="flex flex-col gap-1" data-breakdown-group={group.id}>
          <div className="flex items-baseline justify-between gap-3">
            <span>{group.label}</span>
            <span className="tabular-nums">{group.percent}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${group.percent}%` }} />
          </div>
          {group.prompts.length > 0 && (
            <ul className="flex flex-col gap-0.5 pl-4">
              {group.prompts.map((prompt) => (
                <li key={prompt.type} className="flex items-baseline justify-between gap-3" data-breakdown-prompt={prompt.type}>
                  <Meta>{prompt.label}</Meta>
                  <Meta className="tabular-nums">{prompt.percent}%</Meta>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
