import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronRight, Link2 } from 'lucide-react';
import { EntityIcon, GroupIcon, PersonaIcon } from '@/lib/elementIcons';
import { useGameData, useGameDataOptional } from '@/contexts/GameDataContext';
import type { Entity, Placeholder } from '@/types';
import { addStatLink, statHeldReason } from '@/lib/statLinks';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { ownerChoices, type OwnerChoice } from '@/lib/ownerChoices';
import { heldReasonText, type HeldReason } from '@/lib/heldReasons';
import { labelPlaceholders } from '@/lib/placementLetters';
import { addLink } from '@/lib/traitLinks';
import { linkHeldReason } from '@/lib/traitTree';
import { randomUUID } from '@/lib/uuid';
import { cn } from '@/lib/utils';
import { MENU_ROW } from '@/components/menuRow';
import { DrillSlide, type SlideFrom } from '@/components/DrillSlide';

const NO_PLACEHOLDERS: Placeholder[] = [];

const ownerIcon = (row: Extract<OwnerChoice, { kind: 'owner' }>) => {
  const Icon = row.customPersona ? PersonaIcon : EntityIcon;
  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
};

/**
 * The owners a flyout offers, one entity group level at a time: a group row opens its level, and the Back
 * row above returns to the one before. `back` is the Back row on the top level. With `refusal`, every row
 * starts with a check column, and a row with a reason reads checked and can't be picked. The reason shows
 * in a tip and is the row's accessible description (`aria-description`), so the row stays reachable by keyboard.
 */
export function OwnerList({ choices, label, onPick, refusal, back, leafIcon = ownerIcon }: {
  choices: OwnerChoice[];
  label: string;
  onPick: (id: string) => void;
  /** The reason a row can't be picked; null when it can. */
  refusal?: (id: string) => string | null;
  back?: { label: string; onBack: () => void };
  /** The icon before a pickable row; an entity's by default. */
  leafIcon?: (row: Extract<OwnerChoice, { kind: 'owner' }>) => ReactNode;
}) {
  // Off-world (the showcase) there are no placeholders to draw.
  const placeholders = useGameDataOptional()?.placeholders ?? NO_PLACEHOLDERS;
  const [path, setPath] = useState<string[]>([]);
  const [from, setFrom] = useState<SlideFrom>(null);
  const go = (next: string[], side: SlideFrom) => { setPath(next); setFrom(side); };
  const levelId = path.at(-1) ?? null;
  const level = choices.filter((c) => c.parentId === levelId);
  const backRow = levelId
    ? { label: choices.find((c) => c.id === levelId)?.name ?? '', onBack: () => go(path.slice(0, -1), 'left') }
    : back;
  const text = (name: string) => <PlaceholderText text={name} placeholders={placeholders} />;
  const checkSlot = (on: boolean) => refusal && <Check className={cn('h-4 w-4 shrink-0', on ? 'opacity-100' : 'opacity-0')} aria-hidden />;
  return (
    <DrillSlide key={levelId ?? ''} from={from}>
      {backRow && (
        <>
          {/* Keyed by level, so each level's Back row takes focus as it opens. */}
          <button key={levelId ?? ''} type="button" className={cn(MENU_ROW, 'font-medium')} onClick={backRow.onBack} autoFocus>
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{text(backRow.label)}</span>
          </button>
          <div role="separator" className="-mx-1 my-1 h-px bg-border" />
        </>
      )}
      <ScrollArea className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-4rem))]">
        <div role="group" aria-label={label}>
          {level.map((row) => {
            if (row.kind === 'group') {
              return (
                <button key={row.id} type="button" className={MENU_ROW} onClick={() => go([...path, row.id], 'right')}>
                  {checkSlot(false)}
                  <GroupIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{text(row.name)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              );
            }
            const refused = refusal?.(row.id);
            const reason = refused ? labelPlaceholders(refused, placeholders) : null;
            const button = (
              <button
                type="button"
                aria-disabled={reason ? true : undefined}
                aria-pressed={refusal ? !!reason : undefined}
                aria-description={reason ?? undefined}
                className={cn(MENU_ROW, 'aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-transparent')}
                onClick={() => { if (!reason) onPick(row.id); }}
              >
                {checkSlot(!!reason)}
                {leafIcon(row)}
                <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{text(row.name)}</span>
              </button>
            );
            return <Tip key={row.id} tip={reason} labelsChild={false} side="right">{button}</Tip>;
          })}
        </div>
      </ScrollArea>
    </DrillSlide>
  );
}

/**
 * A **Link To…** button: links an original to each entity picked. An entity that already holds it reads checked,
 * and its row's tip says why. The flyout stays open for the next pick.
 */
function LinkToButton({ held, link }: {
  /** Why the entity already holds the original; null when it can link it. */
  held: (entityId: string) => HeldReason | null;
  link: (entity: Entity) => Entity | null;
}) {
  const { entities, entityGroups, editEntity } = useGameData();
  const [open, setOpen] = useState(false);
  const choices = useMemo(() => ownerChoices(entityGroups, entities), [entityGroups, entities]);
  const reasons = open
    ? new Map(choices.flatMap((c) => {
      const reason = c.kind === 'owner' ? held(c.id) : null;
      return reason ? [[c.id, heldReasonText(reason)] as const] : [];
    }))
    : new Map<string, string>();

  if (!choices.length) return null;
  const pick = (entityId: string) => {
    if (held(entityId)) return;
    editEntity(entityId, (e) => link(e) ?? e);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1">
          <Link2 className="h-3.5 w-3.5" aria-hidden />Link To…
        </Button>
      </PopoverTrigger>
      {/* Inline, so the editor's modal scroll lock lets the wheel reach the list. */}
      <PopoverContent portal={false} side="top" align="end" className="w-60 overflow-hidden p-1">
        <OwnerList choices={choices} label="Link To" onPick={pick} refusal={(id) => reasons.get(id) ?? null} />
      </PopoverContent>
    </Popover>
  );
}

/** The link button in a world trait or group's detail footer: links it to an owner the way a drag into that
 *  owner does. */
export function LinkToOwnerButton({ originalId }: { originalId: string }) {
  const { traits, traitGroups, entities } = useGameData();
  const world = { traits, traitGroups };
  return (
    <LinkToButton
      held={(id) => linkHeldReason(world, entities, id, originalId)}
      link={(e) => addLink(world, e, originalId, randomUUID())}
    />
  );
}

/** The link button in a Blueprint stat or stat group's detail footer. */
export function StatLinkToButton({ originalId }: { originalId: string }) {
  const { stats, statGroups, entities } = useGameData();
  const world = { stats, statGroups };
  const held = (entityId: string) => {
    const entity = entities.find((e) => e.id === entityId);
    return entity ? statHeldReason(world, entity, originalId) : null;
  };
  return (
    <LinkToButton
      held={held}
      link={(e) => addStatLink(world, e, originalId, randomUUID())}
    />
  );
}
