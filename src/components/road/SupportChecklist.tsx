import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SupportChecklistModel } from './useSupportChecklist';

/** The four steps in a fixed order. A finished step changes its mark and hint in place, so no row moves. */
export function SupportChecklist({ checklist }: { checklist: SupportChecklistModel }) {
  const { rows, linkNow, openPatreon, notice } = checklist;
  const current = rows.find((row) => !row.done)?.id;
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li
            key={row.id}
            data-step={row.id}
            data-done={row.done}
            aria-current={row.id === current ? 'step' : undefined}
            className={cn(
              'flex min-h-16 items-center gap-3 rounded-lg border p-3',
              row.id === current ? 'border-primary' : 'border-border',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-meta font-medium',
                row.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
              )}
            >
              {row.done ? <Check className="size-4" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-label font-medium">
                {row.title}
                <span className="sr-only">{row.done ? ', done' : ''}</span>
              </p>
              <p className="text-meta text-muted-foreground">{row.hint}</p>
            </div>
            {row.id === 'pledge' && openPatreon && (
              <Button variant="link" className="shrink-0" onClick={openPatreon}>Open Patreon</Button>
            )}
            {row.id === 'link' && linkNow && (
              <Button variant="link" className="shrink-0" onClick={linkNow}>Link Patreon</Button>
            )}
          </li>
        ))}
      </ol>
      {notice && <p role="alert" className="text-helper text-destructive">{notice}</p>}
    </div>
  );
}
