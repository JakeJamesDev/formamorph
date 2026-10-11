import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronRight, Link2 } from 'lucide-react';
import { EntityIcon, GroupIcon, PersonaIcon } from '@/lib/elementIcons';
import { useGameData, useGameDataOptional } from '@/contexts/GameDataContext';
import type { Entity, Placeholder } from '@/types';
import { addStatLink, holdsStatOriginal } from '@/lib/statLinks';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { bearerChoices, type BearerChoice } from '@/lib/bearerChoices';
import { addLink } from '@/lib/traitLinks';
import { linkRefusal } from '@/lib/traitTree';
import { randomUUID } from '@/lib/uuid';
import { cn } from '@/lib/utils';
import { MENU_ROW } from '@/components/menuRow';
import { DrillSlide, type SlideFrom } from '@/components/DrillSlide';

const NO_PLACEHOLDERS: Placeholder[] = [];

const bearerIcon = (row: Extract<BearerChoice, { kind: 'bearer' }>) => {
  const Icon = row.customPersona ? PersonaIcon : EntityIcon;
  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
};

/**
 * The bearers a flyout offers, one entity group level at a time: a group row opens its level, and the Back
 * row above returns to the one before. `back` is the Back row on the top level. With `held`, every row
 * starts with a check column, and a held bearer reads checked and can't be picked.
 */
export function BearerList({ choices, label, onPick, held, back, leafIcon = bearerIcon }: {
  choices: BearerChoice[];
  label: string;
  onPick: (id: string) => void;
  held?: (id: string) => boolean;
  back?: { label: string; onBack: () => void };
  /** The icon before a pickable row; an entity's by default. */
  leafIcon?: (row: Extract<BearerChoice, { kind: 'bearer' }>) => ReactNode;
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
  const checkSlot = (on: boolean) => held && <Check className={cn('h-4 w-4 shrink-0', on ? 'opacity-100' : 'opacity-0')} aria-hidden />;
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
            const isHeld = held?.(row.id) ?? false;
            return (
              <button
                key={row.id}
                type="button"
                disabled={isHeld}
                aria-pressed={held ? isHeld : undefined}
                className={MENU_ROW}
                onClick={() => onPick(row.id)}
              >
                {checkSlot(isHeld)}
                {leafIcon(row)}
                <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{text(row.name)}</span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </DrillSlide>
  );
}

/**
 * A **Link To…** button: links an original to each entity picked. An entity that already holds it reads checked.
 * The flyout stays open for the next pick.
 */
function LinkToButton({ holds, link }: {
  /** Whether the entity already holds the original. */
  holds: (entityId: string) => boolean;
  link: (entity: Entity) => Entity | null;
}) {
  const { entities, entityGroups, editEntity } = useGameData();
  const [open, setOpen] = useState(false);
  const choices = useMemo(() => bearerChoices(entityGroups, entities), [entityGroups, entities]);
  const held = open
    ? new Set(choices.filter((c) => c.kind === 'bearer' && holds(c.id)).map((c) => c.id))
    : new Set<string>();

  if (!choices.length) return null;
  const pick = (entityId: string) => {
    if (holds(entityId)) return;
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
        <BearerList choices={choices} label="Link To" onPick={pick} held={(id) => held.has(id)} />
      </PopoverContent>
    </Popover>
  );
}

/** The link button in a world trait or group's detail footer: links it to a bearer the way a drag into that
 *  bearer does. */
export function LinkToBearerButton({ originalId }: { originalId: string }) {
  const { traits, traitGroups, entities } = useGameData();
  const world = { traits, traitGroups };
  return (
    <LinkToButton
      holds={(id) => !!linkRefusal(world, entities, id, originalId)}
      link={(e) => addLink(world, e, originalId, randomUUID())}
    />
  );
}

/** The link button in a Blueprint stat or stat group's detail footer. */
export function StatLinkToButton({ originalId }: { originalId: string }) {
  const { stats, statGroups, entities } = useGameData();
  const world = { stats, statGroups };
  const holds = (entityId: string) => {
    const entity = entities.find((e) => e.id === entityId);
    return !entity || holdsStatOriginal(world, entity, originalId);
  };
  return (
    <LinkToButton
      holds={holds}
      link={(e) => addStatLink(world, e, originalId, randomUUID())}
    />
  );
}
