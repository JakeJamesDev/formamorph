// The in-game Traits panel: the authored trait tree as collapsible sections, enabled traits on top and
// everything switched off folded into a per-section Disabled block. A world with a hundred traits has to
// stay readable in a quarter-width column, and the author's grouping is the structure that does it.
//
// The filter and the folds live in Gameplay (`traitsView`), because the tab is unmounted the moment the
// player looks at Stats. They last the session and are never saved.

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, Lock, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildTraitSections, viewTraitSection, type TraitBlock, type TraitSection } from '@/lib/traitSections';
import { WORLD_OWNER, gateOf, groupPickState, leavesShort, type GateStates, type GroupPickState } from '@/lib/traitGates';
import type { Entity, Stat, StatChange, Trait, TraitGroup, TraitsPanelView } from '@/types';
import { Tip } from '@/components/ui/tooltip';
import { gateLine } from '@/lib/traitGateLine';
import { isAlwaysOn, isHidden } from '@/lib/traitEffects';
import { TraitCascadeNotice, type TraitCascade } from './SetupTraitList';

/** What a trait's stat-change list needs of a stat: its name, and whether the player may see it at all. */
export type TraitTabStat = Pick<Stat, 'id' | 'name'> & Pick<Partial<Stat>, 'hidden'>;

export interface TraitsTabProps {
  /** Every trait the panel lists, in authored order: those held plus those still takeable. A trait under two
   *  bearers is listed once per bearer, under each one's node. */
  traits: Trait[];
  groups: TraitGroup[];
  /** Entity node id → the bearer it draws, each holding that bearer's tree. */
  entityNodes?: ReadonlyMap<string, Pick<Entity, 'name'>>;
  /** The entity nodes that are the player's, each marked You: the played persona, and the Custom Persona
   *  entity under None and a library persona. */
  playerEntityIds?: readonly string[];
  stats: TraitTabStat[];
  /** Switched off or never taken in the bearer's tree — the panel draws no line between the two. */
  isOff: (traitId: string, bearerId: string) => boolean;
  /** A past turn is a record, not a control surface. */
  readOnly: boolean;
  onToggleTrait: (traitId: string, enabled: boolean, bearerId: string) => void;
  /** A trait's own text resolved through its own placeholder pins, bound for its bearer. */
  resolveTraitText: (trait: Trait, text: string, bearerId: string) => string;
  /** The tab's own filter/fold state, owned by Gameplay so it outlives the unmount. */
  view: TraitsPanelView;
  setView: React.Dispatch<React.SetStateAction<TraitsPanelView>>;
  /** Each bearer's gates; absent shows every trait open. */
  gates?: GateStates;
  cascade?: TraitCascade | null;
  onDismissCascade?: () => void;
}

/** The same set with `key` added if it was absent, removed if it was there. */
const flipKey = (keys: ReadonlySet<string>, key: string): ReadonlySet<string> => {
  const next = new Set(keys);
  if (!next.delete(key)) next.add(key);
  return next;
};

const EMPTY: ReadonlySet<string> = new Set();

/** The bearer a block's traits belong to: the world's when the block sits in no entity node. */
const bearerOf = (block: TraitBlock): string => block.entityId ?? WORLD_OWNER;

/** Which sections a fresh look at this trait list opens: the ones holding something switched on. */
const seedOpen = (sections: TraitSection[], isOff: (id: string, bearerId: string) => boolean): ReadonlySet<string> =>
  new Set(sections.filter((s) => s.blocks.some((b) => b.traits.some((t) => !isHidden(t) && !isOff(t.id, bearerOf(b))))).map((s) => s.key));

export const TraitsTab = ({
  traits, groups, entityNodes, playerEntityIds = [], stats, isOff, readOnly, onToggleTrait, resolveTraitText, view, setView,
  gates, cascade, onDismissCascade,
}: TraitsTabProps) => {
  const entityNodeIds = React.useMemo(() => new Set(entityNodes?.keys() ?? []), [entityNodes]);
  const isPlayer = (entityId: string | null | undefined) => !!entityId && playerEntityIds.includes(entityId);
  const sections = React.useMemo(() => buildTraitSections(traits, groups, entityNodeIds), [traits, groups, entityNodeIds]);
  // An entity node wears the user glyph, and the played one a You mark, as at Enter World.
  const entityIcon = <User aria-hidden className="h-3.5 w-3.5 shrink-0" />;
  const youMark = <span className="ml-1 text-meta font-normal text-primary">You</span>;
  const sectionKeys = sections.map((s) => s.key).join('|');

  // Which sections stand open is seeded from what is switched on, then owned by the player. It re-seeds only
  // when the section list itself changes (a different world, or paging into a turn that held other traits) —
  // never on a toggle, so switching a trait off can't fold the section under the player's hands. The stored
  // state catches up in an effect; this render already reads the seed, so nothing flashes shut first.
  const stale = view.keys !== sectionKeys;
  const open = stale ? seedOpen(sections, isOff) : view.open;
  const openDisabled = stale ? EMPTY : view.openDisabled;
  const query = view.query;
  React.useEffect(() => {
    if (!stale) return;
    setView((v) => ({ ...v, keys: sectionKeys, open: seedOpen(sections, isOff), openDisabled: EMPTY }));
  });

  // Every flip reads the stored view rather than this render's copy, so two of them in one batch don't
  // overwrite each other — and each falls back to the seed for the render before the effect has stored it.
  const patch = (next: Partial<TraitsPanelView>) => setView((v) => ({ ...v, ...next }));
  const flipSection = (key: string) => setView((v) => ({
    ...v, open: flipKey(v.keys === sectionKeys ? v.open : seedOpen(sections, isOff), key),
  }));
  const flipDisabled = (key: string) => setView((v) => ({
    ...v, openDisabled: flipKey(v.keys === sectionKeys ? v.openDisabled : EMPTY, key),
  }));
  const flipExpanded = (id: string) => setView((v) => ({ ...v, expanded: flipKey(v.expanded, id) }));

  const describe = React.useCallback(
    (trait: Trait, bearerId: string = WORLD_OWNER) => resolveTraitText(trait, trait.playerDescription ?? '', bearerId),
    [resolveTraitText],
  );
  const statById = React.useMemo(() => new Map(stats.map((s) => [s.id, s])), [stats]);
  const filtering = query.trim() !== '';

  const views = sections
    .map((section) => ({ section, view: viewTraitSection(section, { query, isOff: (id, b) => isOff(id, b ?? WORLD_OWNER), describe }) }))
    .flatMap(({ section, view }) => (view ? [{ section, view }] : []));
  // A cast entity's trait carries its bearer's name, as the log does; the player's own read bare.
  const active = sections.flatMap((s) => s.blocks.flatMap((b) => b.traits
    .filter((t) => !isHidden(t) && !isOff(t.id, bearerOf(b)))
    .map((t) => (b.entityId && !isPlayer(b.entityId) ? `${entityNodes?.get(b.entityId)?.name ?? b.entityId}'s ${t.name}` : t.name))));

  // Counted on the whole block: the view splits each block into enabled and disabled halves.
  const picks = new Map<string, GroupPickState>(sections.flatMap((s) => s.blocks.flatMap((b) => (b.group
    ? [[`${bearerOf(b)}/${b.key}`, groupPickState(b.group, b.traits, b.traits.filter((t) => !isOff(t.id, bearerOf(b))).map((t) => t.id))] as const]
    : []))));
  const fixedBlocks = new Set(sections.flatMap((s) => s.blocks
    .filter((b) => b.traits.some((t) => isAlwaysOn(t) && !isOff(t.id, bearerOf(b))))
    .map((b) => `${bearerOf(b)}/${b.key}`)));

  const row = (trait: Trait, block: TraitBlock, off: boolean) => {
    const bearerId = bearerOf(block);
    const pick = picks.get(`${bearerId}/${block.key}`);
    const radio = pick?.max === 1;
    const rowKey = `${bearerId}/${trait.id}`;
    // A change is listed only if the player can see the stat it targets: hidden stats stay behind the
    // scenes, and one whose stat the world no longer has would otherwise print a raw id.
    const changes = trait.statChanges
      .map((change) => ({ change, stat: statById.get(change.statId) }))
      .filter((c): c is { change: StatChange; stat: TraitTabStat } => c.stat !== undefined && c.stat.hidden !== true);
    const isExpanded = view.expanded.has(rowKey);
    const description = describe(trait, bearerId).trim();
    const toggleLabel = `${off ? 'Switch on' : 'Switch off'} ${trait.name}`;
    const gate = gates && gateOf(gates, bearerId, trait.id);
    const locked = gate?.unlocked === false;
    const line = gateLine(gate);
    // A switch-on needs an open gate and a group below its max, and a max-one group's active Always On trait
    // can't be swapped out. A switch-off must not leave the group below its min.
    const fixedIn = fixedBlocks.has(`${bearerId}/${block.key}`);
    const disabled = readOnly || (off ? locked || (radio ? fixedIn : !!pick?.full) : !!pick && leavesShort(pick));
    const name = (
      <span className="inline-flex items-center gap-1.5 font-medium">
        {trait.name}
        {locked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />}
      </span>
    );
    return (
      <div
        key={rowKey}
        className={cn('flex items-start gap-2 rounded px-1 py-1 hover:bg-accent/50', off && 'opacity-50')}
      >
        {trait.playerToggle && !isAlwaysOn(trait) && (radio ? (
          <button
            type="button"
            role="radio"
            aria-checked={!off}
            aria-label={toggleLabel}
            disabled={disabled}
            onClick={() => onToggleTrait(trait.id, off, bearerId)}
            className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!off && <span className="h-2 w-2 rounded-full bg-primary" />}
          </button>
        ) : (
          <Checkbox
            className="mt-1"
            checked={!off}
            disabled={disabled}
            aria-label={toggleLabel}
            onCheckedChange={(checked) => onToggleTrait(trait.id, checked === true, bearerId)}
          />
        ))}
        {/* A trait's own text self-pins (its name already did, via the resolved collection), so a pinning
            trait's row reads its own value whatever else is switched on. */}
        <div className="min-w-0 flex-1">
          {changes.length > 0 ? (
            <button
              type="button"
              className="flex w-full items-start gap-1 text-left"
              aria-expanded={isExpanded}
              onClick={() => flipExpanded(rowKey)}
            >
              <span className="min-w-0 flex-1">
                {name}
                {description && <span className="block text-label text-muted-foreground">{description}</span>}
              </span>
              {/* The row's only sign that it has stat changes to show, and the only feedback that it is open. */}
              <ChevronDown
                className={cn('mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                  !isExpanded && '-rotate-90')}
              />
            </button>
          ) : (
            <>
              {name}
              {description && <p className="text-label text-muted-foreground">{description}</p>}
            </>
          )}
          {line && <p className={cn('text-meta', locked ? 'text-foreground' : 'text-muted-foreground')}>{line}</p>}
          {isExpanded && changes.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-helper text-muted-foreground">
              {changes.map(({ change, stat }, i) => (
                <li key={i}>
                  {resolveTraitText(trait, stat.name, bearerId)}:{' '}
                  <span className={change.value > 0 ? 'text-success' : 'text-destructive'}>
                    {change.value > 0 ? '+' : ''}{change.value}
                  </span>
                  {change.type && change.type !== 'starting' ? ` (${change.type})` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const rows = (blocks: TraitBlock[]) =>
    blocks.map((block) => (
      <div key={block.key}>
        {block.subheader && (
          <p className="mb-0.5 mt-1.5 flex items-center gap-1 pl-1 text-meta font-medium text-muted-foreground">
            {/* The glyph and the You mark sit on the node's own heading, not on every group below it. */}
            {block.entityNode && entityIcon}
            {block.subheader}
            {block.entityNode && isPlayer(block.entityId) && youMark}
          </p>
        )}
        {block.traits.map((trait) => row(trait, block, isOff(trait.id, bearerOf(block))))}
      </div>
    ));

  if (sections.length === 0) return <p>No traits acquired.</p>;

  return (
    <div className="flex h-full flex-col">
      <div className="relative mb-2 flex-shrink-0">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => patch({ query: e.target.value })}
          aria-label="Filter traits"
          placeholder="Filter traits…"
          className="h-8 pl-7 text-label"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 pb-2">
          {active.length > 0 && (
            // The clipped list spelled out; the line already reads itself out in full to a screen reader.
            <Tip tip={active.join(', ')} labelsChild={false}>
              <p className="truncate px-1 text-helper text-muted-foreground">
                <span className="font-medium text-foreground/70">{active.length} active:</span>{' '}
                {active.join(', ')}
              </p>
            </Tip>
          )}
          {views.length === 0 && <p className="px-1 text-label text-muted-foreground">No traits match “{query.trim()}”.</p>}
          {views.map(({ section, view }) => {
            // A filter that matched inside a collapsed section has to open it, or the result is invisible.
            const isOpen = section.name === null || filtering || open.has(section.key);
            const disabledOpen = filtering || openDisabled.has(section.key);
            const played = isPlayer(section.entityId);
            return (
              <div
                key={section.key}
                role="group"
                aria-label={section.name ?? 'Traits'}
                className="rounded-lg bg-muted/40 p-1.5"
              >
                {section.name !== null && (
                  <button
                    type="button"
                    onClick={() => flipSection(section.key)}
                    // A filter holds every matching section open, so the header would otherwise flip a
                    // state nothing on screen reflects — and spring it on the player when they clear it.
                    disabled={filtering}
                    aria-expanded={isOpen}
                    aria-label={`${section.name}${played ? ', You' : ''}, ${view.enabledCount} enabled`}
                    className="flex w-full items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-left text-primary"
                  >
                    {section.entityId && entityIcon}
                    <span className="flex-1 font-semibold">{section.name}{played && youMark}</span>
                    {view.enabledCount === 0 ? (
                      <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">0</Badge>
                    ) : (
                      <Badge>{view.enabledCount}</Badge>
                    )}
                    <ChevronDown className={cn('h-4 w-4 transition-transform', !isOpen && '-rotate-90')} />
                  </button>
                )}
                {isOpen && (
                  <div className="pt-1">
                    {rows(view.enabled)}
                    {view.disabledCount > 0 && (
                      <div className="mt-1 rounded border border-dashed border-border p-1">
                        <button
                          type="button"
                          onClick={() => flipDisabled(section.key)}
                          disabled={filtering}
                          aria-expanded={disabledOpen}
                          className="flex w-full items-center gap-1 text-label text-muted-foreground"
                        >
                          <ChevronDown className={cn('h-3 w-3 transition-transform', !disabledOpen && '-rotate-90')} />
                          Disabled ({view.disabledCount})
                        </button>
                        {disabledOpen && <div className="pt-1">{rows(view.disabled)}</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {cascade && onDismissCascade && <TraitCascadeNotice cascade={cascade} onDismiss={onDismissCascade} />}
        </div>
      </ScrollArea>
    </div>
  );
};
