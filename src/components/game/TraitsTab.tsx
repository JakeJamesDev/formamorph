// The in-game Traits panel: the authored trait tree as collapsible sections, enabled traits on top and
// everything switched off folded into a per-section Disabled block. A world with a hundred traits has to
// stay readable in a quarter-width column, and the author's grouping is the structure that does it.
//
// Expand/collapse state is deliberately session-only — the tab opens on the same sensible default every
// time rather than on whatever the player last left behind.

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildTraitSections, viewTraitSection, type TraitBlock, type TraitSection } from '@/lib/traitSections';
import type { Stat, StatChange, Trait, TraitGroup } from '@/types';

/** What a trait's stat-change list needs of a stat: its name, and whether the player may see it at all. */
export type TraitTabStat = Pick<Stat, 'id' | 'name'> & Pick<Partial<Stat>, 'hidden'>;

export interface TraitsTabProps {
  /** Every trait the panel lists, in authored order: those held plus those still takeable. */
  traits: Trait[];
  groups: TraitGroup[];
  stats: TraitTabStat[];
  /** Switched off or never taken — the panel draws no line between the two. */
  isOff: (traitId: string) => boolean;
  /** A past turn is a record, not a control surface. */
  readOnly: boolean;
  onToggleTrait: (traitId: string, enabled: boolean) => void;
  /** A trait's own text resolved through its own placeholder pins. */
  resolveTraitText: (trait: Trait, text: string) => string;
}

/** Flip one key in a set of open/expanded keys. */
const useKeySet = () => {
  const [keys, setKeys] = React.useState<ReadonlySet<string>>(new Set());
  const flip = React.useCallback((key: string) => {
    setKeys((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);
  return [keys, flip, setKeys] as const;
};

const sectionHasEnabled = (section: TraitSection, isOff: (id: string) => boolean) =>
  section.blocks.some((b) => b.traits.some((t) => !isOff(t.id)));

export const TraitsTab = ({
  traits, groups, stats, isOff, readOnly, onToggleTrait, resolveTraitText,
}: TraitsTabProps) => {
  const [query, setQuery] = React.useState('');
  const [flipped, flipSection, setFlipped] = useKeySet();
  const [openDisabled, flipDisabled, setOpenDisabled] = useKeySet();
  const [expanded, flipExpanded] = useKeySet();

  const sections = React.useMemo(() => buildTraitSections(traits, groups), [traits, groups]);
  const sectionKeys = sections.map((s) => s.key).join('|');

  // The default open set is a first-look layout, not a live rule: it is settled when the section list itself
  // changes (a new world, or paging into a turn that held different traits) and never re-derived on a
  // toggle, so switching a trait off can't collapse the section under the player's hands.
  const [lastKeys, setLastKeys] = React.useState(sectionKeys);
  const [defaultOpen, setDefaultOpen] = React.useState<ReadonlySet<string>>(
    () => new Set(sections.filter((s) => sectionHasEnabled(s, isOff)).map((s) => s.key)),
  );
  if (lastKeys !== sectionKeys) {
    setLastKeys(sectionKeys);
    setDefaultOpen(new Set(sections.filter((s) => sectionHasEnabled(s, isOff)).map((s) => s.key)));
    setFlipped(new Set());
    setOpenDisabled(new Set());
  }

  const describe = React.useCallback(
    (trait: Trait) => resolveTraitText(trait, trait.playerDescription ?? ''),
    [resolveTraitText],
  );
  const statById = React.useMemo(() => new Map(stats.map((s) => [s.id, s])), [stats]);
  const filtering = query.trim() !== '';

  const views = sections
    .map((section) => ({ section, view: viewTraitSection(section, { query, isOff, describe }) }))
    .flatMap(({ section, view }) => (view ? [{ section, view }] : []));
  const active = sections.flatMap((s) => s.blocks.flatMap((b) => b.traits)).filter((t) => !isOff(t.id));

  const row = (trait: Trait, block: TraitBlock, off: boolean) => {
    // A change is listed only if the player can see the stat it targets: hidden stats stay behind the
    // scenes, and one whose stat the world no longer has would otherwise print a raw id.
    const changes = trait.statChanges
      .map((change) => ({ change, stat: statById.get(change.statId) }))
      .filter((c): c is { change: StatChange; stat: TraitTabStat } => c.stat !== undefined && c.stat.hidden !== true);
    const isExpanded = expanded.has(trait.id);
    const description = describe(trait).trim();
    const toggleLabel = `${off ? 'Switch on' : 'Switch off'} ${trait.name}`;
    return (
      <div
        key={trait.id}
        className={cn('flex items-start gap-2 rounded px-1 py-1 hover:bg-accent/50', off && 'opacity-50')}
      >
        {trait.playerToggle && (block.exclusive ? (
          <button
            type="button"
            role="radio"
            aria-checked={!off}
            aria-label={toggleLabel}
            disabled={readOnly}
            onClick={() => onToggleTrait(trait.id, off)}
            className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!off && <span className="h-2 w-2 rounded-full bg-primary" />}
          </button>
        ) : (
          <Checkbox
            className="mt-1"
            checked={!off}
            disabled={readOnly}
            aria-label={toggleLabel}
            onCheckedChange={(checked) => onToggleTrait(trait.id, checked === true)}
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
              onClick={() => flipExpanded(trait.id)}
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium">{trait.name}</span>
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
              <span className="font-medium">{trait.name}</span>
              {description && <p className="text-label text-muted-foreground">{description}</p>}
            </>
          )}
          {isExpanded && changes.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-helper text-muted-foreground">
              {changes.map(({ change, stat }, i) => (
                <li key={i}>
                  {resolveTraitText(trait, stat.name)}:{' '}
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
          <p className="mb-0.5 mt-1.5 pl-1 text-meta font-medium text-muted-foreground">{block.subheader}</p>
        )}
        {block.traits.map((trait) => row(trait, block, isOff(trait.id)))}
      </div>
    ));

  if (sections.length === 0) return <p>No traits acquired.</p>;

  return (
    <div className="flex h-full flex-col">
      <div className="relative mb-2 flex-shrink-0">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter traits"
          placeholder="Filter traits…"
          className="h-8 pl-7 text-label"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 pb-2">
          {active.length > 0 && (
            <p className="truncate px-1 text-helper text-muted-foreground" title={active.map((t) => t.name).join(', ')}>
              <span className="font-medium text-foreground/70">{active.length} active:</span>{' '}
              {active.map((t) => t.name).join(', ')}
            </p>
          )}
          {views.length === 0 && <p className="px-1 text-label text-muted-foreground">No traits match “{query.trim()}”.</p>}
          {views.map(({ section, view }) => {
            // A filter that matched inside a collapsed section has to open it, or the result is invisible.
            const isOpen = section.name === null || filtering
              || (flipped.has(section.key) !== defaultOpen.has(section.key));
            const disabledOpen = filtering || openDisabled.has(section.key);
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
                    aria-label={`${section.name}, ${view.enabledCount} enabled`}
                    className="flex w-full items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-left text-primary"
                  >
                    <span className="flex-1 font-semibold">{section.name}</span>
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
        </div>
      </ScrollArea>
    </div>
  );
};
