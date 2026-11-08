import { useId, useState } from 'react';
import { ChevronRight, Eye, EyeOff, ListChecks, Undo2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { entryLine, listCounts, type ListedAction, type ListedActionKind, type SentActionList } from '@/lib/actionList';
import { ItemIcon, LocationIcon, PersonaIcon, StatIcon, TraitIcon } from '@/lib/elementIcons';
import { cn } from '@/lib/utils';

/** Each entry wears the icon of the panel tab it came from (Q27). */
const SOURCE_ICON: Record<ListedActionKind, LucideIcon> = {
  use: ItemIcon, equip: ItemIcon, unequip: ItemIcon, give: ItemIcon, drop: ItemIcon, pickup: ItemIcon, stat: StatIcon,
  trait: TraitIcon, travel: LocationIcon, persona: PersonaIcon,
};

function RowButton({ tip, icon: Icon, disabled, onClick }: { tip: string; icon: LucideIcon; disabled: boolean; onClick: () => void }) {
  return (
    <Tip tip={tip}>
      <Button variant="ghost" size="xs" className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground" disabled={disabled} onClick={onClick}>
        <Icon className="h-4 w-4" aria-hidden />
      </Button>
    </Tip>
  );
}

/** A sent page's list under its action line, read-only. A row the AI never heard reads as player-only (Q4, Q31). */
export function SentActions({ sent }: { sent: SentActionList<unknown> | undefined }) {
  if (!sent?.entries.length) return null;
  return (
    <ul className="mt-1.5 space-y-0.5" aria-label="Since Last Turn" data-testid="sent-action-list">
      {sent.entries.map((entry) => {
        const Icon = SOURCE_ICON[entry.facts.kind];
        const onlyYou = entry.hidden || !sent.told;
        return (
          <li key={entry.id} className="flex items-center gap-2" data-only-you={onlyYou || undefined}>
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{entryLine(entry)}</span>
            {onlyYou && <Meta className="shrink-0">Only You</Meta>}
          </li>
        );
      })}
    </ul>
  );
}

/** The Action List above the action box: a header that counts and folds, then one row per entry. */
export function ActionListTray({ entries, disabled, onUndo, onToggleHidden }: {
  entries: readonly ListedAction<unknown>[];
  /** Off while a turn runs. */
  disabled: boolean;
  onUndo: () => void;
  onToggleHidden: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  if (entries.length === 0) return null;
  const { shown, hidden } = listCounts(entries);
  return (
    <section className="rounded-md border bg-card" aria-label="Since Last Turn" data-testid="action-list-tray">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium">Since Last Turn</span>
        <Meta className="min-w-0 truncate">
          {shown} for the AI{hidden > 0 && ` · ${hidden} hidden`}
        </Meta>
        <ChevronRight
          aria-hidden
          className={cn('ml-auto h-4 w-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-90')}
        />
      </button>
      <div
        id={bodyId}
        data-state={open ? 'open' : 'closed'}
        inert={!open}
        className="grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="border-t px-1.5 py-1">
            {entries.map((entry, i) => {
              const Icon = SOURCE_ICON[entry.facts.kind];
              const newest = i === entries.length - 1;
              return (
                <li key={entry.id} className={cn('flex min-h-8 items-center gap-2 rounded-sm px-1.5 text-label', entry.hidden && 'text-muted-foreground')}>
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden data-testid="action-list-icon" />
                  <span className="min-w-0 flex-1 truncate">{entryLine(entry)}</span>
                  {entry.hidden && <Meta className="shrink-0">Only You</Meta>}
                  <RowButton
                    tip={entry.hidden ? 'Tell the AI' : 'Hide from the AI'} icon={entry.hidden ? EyeOff : Eye}
                    disabled={disabled} onClick={() => onToggleHidden(entry.id)}
                  />
                  {newest
                    ? <RowButton tip={entry.count > 1 ? 'Undo One' : 'Undo'} icon={Undo2} disabled={disabled} onClick={onUndo} />
                    : <span className="w-7 shrink-0" aria-hidden />}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
