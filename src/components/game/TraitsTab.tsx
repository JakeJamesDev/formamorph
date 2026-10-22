// The in-game Traits panel: the authored trait tree as collapsible sections, enabled traits on top and
// everything switched off folded into a per-section Disabled block. A world with a hundred traits has to
// stay readable in a quarter-width column, and the author's grouping is the structure that does it.
//
// The filter and the folds live in Gameplay (`traitsView`), because the tab is unmounted the moment the
// player looks at Stats. They last the session and are never saved.

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchField } from '@/components/ui/search-field';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, Lock } from 'lucide-react';
import { EntityIcon } from '@/lib/elementIcons';
import { cn } from '@/lib/utils';
import { buildTraitSections, groupGlobalSections, viewTraitSection, type TraitBlock, type TraitSection } from '@/lib/traitSections';
import { gateOf, groupPickState, leavesShort, type GateStates, type GroupPickState } from '@/lib/traitGates';
import { scopeKey, type OwnerId } from '@/lib/scope';
import type { Entity, Stat, StatChange, Trait, TraitGroup, TraitsPanelView } from '@/types';
import { Tip } from '@/components/ui/tooltip';
import { gateLineParts } from '@/lib/traitGateLine';
import { GateLineText } from '@/components/game/GateLineText';
import { isAlwaysOn, isHidden } from '@/lib/traitEffects';
import { statRowSide } from '@/lib/traitTree';
import { TraitCascadeNotice, type TraitCascade } from './SetupTraitList';
import { YouMark } from './YouMark';
import { PanelOwnerCard, PanelSubheader } from './PanelOwnerCard';

/** What a trait's stat-change list needs of a stat: its name, and whether the player may see it at all. */
export type TraitTabStat = Pick<Stat, 'id' | 'name'> & Pick<Partial<Stat>, 'hidden'>;

export interface TraitsTabProps {
  /** Every trait the panel lists, in authored order: those held plus those still takeable. A trait under two
   *  owners is listed once per owner, under each one's node. */
  traits: Trait[];
  groups: TraitGroup[];
  /** Entity node id → the owner it draws, each holding that owner's tree. */
  entityNodes?: ReadonlyMap<string, Pick<Entity, 'name'>>;
  /** The entity nodes that are the player's, each marked You: the played persona, and the Custom Persona
   *  entity under None and a library persona. */
  playerEntityIds?: readonly string[];
  stats: TraitTabStat[];
  /** Each entity's own stats, by entity id. A cast entity's trait lists changes to these alone; a player
   *  entity's lists these first, then `stats`. Absent ⇒ none. */
  ownerStats?: Readonly<Record<string, readonly TraitTabStat[]>>;
  /** Switched off or never taken in the owner's tree — the panel draws no line between the two. */
  isOff: (traitId: string, ownerId: OwnerId) => boolean;
  /** A past turn is a record, not a control surface. */
  readOnly: boolean;
  onToggleTrait: (traitId: string, enabled: boolean, ownerId: OwnerId) => void;
  /** A trait's own text resolved through its own placeholder pins, bound for its owner. */
  resolveTraitText: (trait: Trait, text: string, ownerId: OwnerId) => string;
  /** The tab's own filter/fold state, owned by Gameplay so it outlives the unmount. */
  view: TraitsPanelView;
  setView: React.Dispatch<React.SetStateAction<TraitsPanelView>>;
  /** Each owner's gates; absent shows every trait open. */
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
const NO_IDS: readonly string[] = [];

/** The owner a block's traits belong to: null for global scope when the block sits in no entity node. */
const ownerOf = (block: TraitBlock): OwnerId => block.entityId ?? null;

/** Which sections a fresh look at this trait list opens: the ones holding something switched on. */
const seedOpen = (sections: TraitSection[], isOff: (id: string, ownerId: OwnerId) => boolean): ReadonlySet<string> =>
  new Set(sections.filter((s) => s.blocks.some((b) => b.traits.some((t) => !isHidden(t) && !isOff(t.id, ownerOf(b))))).map((s) => s.key));

export const TraitsTab = ({
  traits, groups, entityNodes, playerEntityIds = NO_IDS, stats, ownerStats, isOff, readOnly, onToggleTrait, resolveTraitText, view, setView,
  gates, cascade, onDismissCascade,
}: TraitsTabProps) => {
  const entityNodeIds = React.useMemo(() => new Set(entityNodes?.keys() ?? []), [entityNodes]);
  const isPlayer = (entityId: string | null | undefined) => !!entityId && playerEntityIds.includes(entityId);
  const sections = React.useMemo(
    () => groupGlobalSections(buildTraitSections(traits, groups, entityNodeIds)),
    [traits, groups, entityNodeIds],
  );
  // An entity node wears the user glyph, and the played one the You pill, as at Enter World.
  const entityIcon = <EntityIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />;
  const youMark = <YouMark />;
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
    (trait: Trait, ownerId: OwnerId = null) => resolveTraitText(trait, trait.playerDescription ?? '', ownerId),
    [resolveTraitText],
  );
  // The stat a trait change moves: a global trait's moves a global stat, and an entity's as its row routes.
  const statOf = React.useMemo(() => {
    const global = new Map(stats.map((s) => [s.id, s]));
    const globalIds = new Set(global.keys());
    const cache = new Map<string, Map<string, TraitTabStat>>();
    const ownOf = (ownerId: string) => {
      let found = cache.get(ownerId);
      if (!found) cache.set(ownerId, found = new Map((ownerStats?.[ownerId] ?? []).map((s) => [s.id, s])));
      return found;
    };
    return (ownerId: OwnerId, change: StatChange): TraitTabStat | undefined => {
      if (ownerId === null) return global.get(change.statId);
      const own = ownOf(ownerId);
      const side = statRowSide(change, new Set(own.keys()), globalIds);
      return side === 'own' ? own.get(change.statId) : side === 'global' ? global.get(change.statId) : undefined;
    };
  }, [stats, ownerStats]);
  const filtering = query.trim() !== '';

  const views = sections
    .map((section) => ({ section, view: viewTraitSection(section, { query, isOff: (id, b) => isOff(id, b ?? null), describe }) }))
    .flatMap(({ section, view }) => (view ? [{ section, view }] : []));
  // A cast entity's trait carries its owner's name, as the log does; global and played traits read bare.
  const active = sections.flatMap((s) => s.blocks.flatMap((b) => b.traits
    .filter((t) => !isHidden(t) && !isOff(t.id, ownerOf(b)))
    .map((t) => (b.entityId && !isPlayer(b.entityId) ? `${entityNodes?.get(b.entityId)?.name ?? b.entityId}'s ${t.name}` : t.name))));

  // Counted on the whole block: the view splits each block into enabled and disabled halves.
  const picks = new Map<string, GroupPickState>(sections.flatMap((s) => s.blocks.flatMap((b) => (b.group
    ? [[`${scopeKey(ownerOf(b))}/${b.key}`, groupPickState(b.group, b.traits, b.traits.filter((t) => !isOff(t.id, ownerOf(b))).map((t) => t.id))] as const]
    : []))));
  const fixedBlocks = new Set(sections.flatMap((s) => s.blocks
    .filter((b) => b.traits.some((t) => isAlwaysOn(t) && !isOff(t.id, ownerOf(b))))
    .map((b) => `${scopeKey(ownerOf(b))}/${b.key}`)));

  const row = (trait: Trait, block: TraitBlock, off: boolean) => {
    const ownerId = ownerOf(block);
    const pick = picks.get(`${scopeKey(ownerId)}/${block.key}`);
    const radio = pick?.max === 1;
    const rowKey = `${scopeKey(ownerId)}/${trait.id}`;
    // A change is listed only if the player can see the stat it targets: hidden stats stay behind the
    // scenes, and one whose stat the world no longer has would otherwise print a raw id.
    const changes = trait.statChanges
      .map((change) => ({ change, stat: statOf(ownerId, change) }))
      .filter((c): c is { change: StatChange; stat: TraitTabStat } => c.stat !== undefined && c.stat.hidden !== true);
    const isExpanded = view.expanded.has(rowKey);
    const description = describe(trait, ownerId).trim();
    const toggleLabel = `${off ? 'Switch on' : 'Switch off'} ${trait.name}`;
    const gate = gates && gateOf(gates, ownerId, trait.id);
    const locked = gate?.unlocked === false;
    const line = gateLineParts(gate);
    // A switch-on needs an open gate and a group below its max, and a max-one group's active Automatic trait
    // can't be swapped out. A switch-off must not leave the group below its min.
    const fixedIn = fixedBlocks.has(`${scopeKey(ownerId)}/${block.key}`);
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
            onClick={() => onToggleTrait(trait.id, off, ownerId)}
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
            onCheckedChange={(checked) => onToggleTrait(trait.id, checked === true, ownerId)}
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
          {line && <p className={cn('text-meta', locked ? 'text-foreground' : 'text-muted-foreground')}><GateLineText parts={line} /></p>}
          {isExpanded && changes.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-helper text-muted-foreground">
              {changes.map(({ change, stat }, i) => (
                <li key={i}>
                  {resolveTraitText(trait, stat.name, ownerId)}:{' '}
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
          <PanelSubheader>
            {/* The glyph and the You pill sit on the node's own heading, not on every group below it. */}
            {block.entityNode && entityIcon}
            {/* One span, so the pill keeps its own gap from the name instead of adding the row's. */}
            <span>{block.subheader}{block.entityNode && isPlayer(block.entityId) && youMark}</span>
          </PanelSubheader>
        )}
        {block.traits.map((trait) => row(trait, block, isOff(trait.id, ownerOf(block))))}
      </div>
    ));

  if (sections.length === 0) return <p>No traits acquired.</p>;

  return (
    <div className="flex h-full flex-col">
      <SearchField
        value={query}
        onChange={(next) => patch({ query: next })}
        aria-label="Filter traits"
        placeholder="Filter traits…"
        size="sm"
        className="mb-2 flex-shrink-0"
        inputClassName="text-label"
      />
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
              <PanelOwnerCard
                key={section.key}
                role="group"
                aria-label={section.name ?? 'Traits'}
                name={section.name}
                entity={!!section.entityId}
                you={played}
                badge={view.enabledCount === 0 ? (
                  <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">0</Badge>
                ) : (
                  <Badge>{view.enabledCount}</Badge>
                )}
                open={isOpen}
                onToggle={() => flipSection(section.key)}
                // A filter holds every matching section open, so the header would otherwise flip a
                // state nothing on screen reflects — and spring it on the player when they clear it.
                disabled={filtering}
                toggleLabel={`${section.name}${played ? ', You' : ''}, ${view.enabledCount} enabled`}
              >
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
              </PanelOwnerCard>
            );
          })}
          {cascade && onDismissCascade && <TraitCascadeNotice cascade={cascade} onDismiss={onDismissCascade} />}
        </div>
      </ScrollArea>
    </div>
  );
};
