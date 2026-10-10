import { Fragment, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { StatLayoutNode } from '@/lib/statGroupTree';
import { cn } from '@/lib/utils';

/**
 * The stat panel's rows laid out as the author grouped them: each group is a collapsible heading over the
 * stats and groups it holds. Every group starts open, and the open state is the section's own, since a panel
 * that remounts has nothing the player set. `nameOf` resolves a group's chips for display.
 */
export function StatGroupSections<T>({ nodes, idOf, nameOf, renderStat }: {
  nodes: StatLayoutNode<T>[];
  idOf: (item: T) => string;
  nameOf: (name: string) => string;
  renderStat: (item: T) => ReactNode;
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const flip = (id: string) => setClosed((held) => {
    const next = new Set(held);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  const draw = (list: StatLayoutNode<T>[], nested: boolean): ReactNode => (
    <div className={cn(nested && 'ml-2 border-l border-border pl-1')}>
      {list.map((node) => {
        if (node.kind === 'stat') return <Fragment key={`stat:${idOf(node.item)}`}>{renderStat(node.item)}</Fragment>;
        const open = !closed.has(node.group.id);
        return (
          <section key={`group:${node.group.id}`} aria-label={nameOf(node.group.name)} className="mt-1">
            <button
              type="button"
              onClick={() => flip(node.group.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-1 px-2 py-1 text-left text-label font-medium text-muted-foreground"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !open && '-rotate-90')} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{nameOf(node.group.name)}</span>
            </button>
            {open && draw(node.children, true)}
          </section>
        );
      })}
    </div>
  );

  return <>{draw(nodes, false)}</>;
}
