import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CHIP_BASE, ChipRenameInput } from '@/components/Chip';
import { Tip } from '@/components/ui/tooltip';
import { chipSectionOpens, usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { decodePlaceholderToken } from '@/lib/placeholders';
import { placeholderCycleExclusions } from '@/lib/placeholderTree';
import { usePaletteCollapsed } from '@/lib/usePaletteCollapsed';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';
import { useChipInsertTarget } from './ChipInsertTarget';
import { CHIP_DRAG_MIME } from './ChipDrag';
import OwnerHeadingChip from './OwnerHeadingChip';

/**
 * One palette of the world's placeholders for a whole editor panel, rather than an insert row on every
 * field. With a dozen placeholders and a chip editor on every name, per-field rows cost more height than
 * the fields themselves; a single strip pays that once and doubles as a reminder of what the world defines.
 *
 * Clicking a chip inserts it into the field that last held focus (see ChipInsertTarget) — clicking the
 * strip necessarily blurs that field, which is exactly why the claim outlives the blur.
 */
const PlaceholderPaletteBar = ({ placeholders, scopeId, className }: {
  placeholders: Placeholder[];
  /** The entity or book whose panel the strip sits over, so its own scoped placeholders come first and
   *  read bare while every other owner's read `Owner.Name`. */
  scopeId?: string;
  className?: string;
}) => {
  const [collapsed, setCollapsed] = usePaletteCollapsed();
  const { insert, undo, ownerId } = useChipInsertTarget();
  const vocab = usePlaceholderChipVocabulary(placeholders, scopeId);
  const all = useMemo(() => vocab.palette(), [vocab]);
  // A rename edits the placeholder's own name; the chip may read it under an owner prefix.
  const bareName = (token: string) => placeholders.find((p) => p.id === decodePlaceholderToken(token)?.id)?.name ?? '';
  // While a placeholder's own value is the target, the chips that would loop back into it are left out —
  // the placeholder itself and everything that already reaches it. The menu is filtered rather than the
  // insert refused, so a loop cannot be authored from here at all.
  const excluded = useMemo(
    () => (ownerId ? placeholderCycleExclusions(placeholders, ownerId) : null),
    [placeholders, ownerId],
  );
  const items = useMemo(
    () => (excluded ? all.filter((item) => !excluded.has(decodePlaceholderToken(item.token)?.id ?? '')) : all),
    [all, excluded],
  );
  const [renaming, setRenaming] = useState<string | null>(null);

  // Inserting happens on mouse-down, so the first half of a double-click has already dropped a chip into the
  // claimed field by the time the gesture turns out to be a rename. Taking it back through that field's own
  // history leaves the text exactly as it was — the alternative, waiting to see whether a second click
  // arrives, would put a delay on every insert to serve the rarer gesture.
  const startRename = (token: string) => {
    undo?.();
    setRenaming(token);
  };

  // Nothing defined means nothing to insert; the strip would be a header explaining its own emptiness. A
  // strip emptied only by the cycle filter stays, so the panel does not reflow as focus moves.
  if (!all.length) return null;

  return (
    // Insertable placeholders, not a field's contents — the find bar must not offer one of these as the
    // place a hit on a placeholder's name lives.
    <div data-editor-find-skip className={cn('sticky top-0 z-10 -mx-1 mb-2 border-b bg-background/95 px-1 py-1.5 backdrop-blur', className)}>
      <div className="flex items-start gap-2">
        {/* Open, the toggle is the chevron alone: the strip's first slot is worth more as a chip than as a
            word, and the tooltip and the accessible name still carry it. Closed, the word comes back with
            the count, because a folded strip has nothing else left to say what it holds. */}
        <Tip tip="Placeholders" labelsChild={false}>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-label="Placeholders"
            className="flex flex-shrink-0 items-center gap-1 rounded px-1 py-0.5 text-meta text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {collapsed && <>Placeholders<span className="text-[10px] opacity-70"> ({items.length})</span></>}
          </button>
        </Tip>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {/* The rows come sectioned — loose, then each folder, then each owner. A section opens with its
                heading, and a rule keeps a heading from claiming the loose chips after it. */}
            {items.map((item, i) => {
              const opens = chipSectionOpens(items, i);
              return (
              <Fragment key={item.token}>
              {opens && i > 0 && <span aria-hidden className="mx-0.5 h-4 w-px self-center bg-border" />}
              {opens && item.heading && (
                item.headingKind === 'owner' && item.ownerKind ? (
                  <OwnerHeadingChip kind={item.ownerKind} name={item.ownerName ?? item.heading} placeholders={placeholders} />
                ) : (
                  <span className="text-meta text-muted-foreground">{item.heading}</span>
                )
              )}
              {renaming === item.token ? (
              <ChipRenameInput
                value={bareName(item.token)}
                ariaLabel={`Rename ${item.label}`}
                style={{ backgroundColor: item.color, color: '#000' }}
                onCommit={(next) => { setRenaming(null); vocab.rename?.(item.token, next); }}
                onCancel={() => setRenaming(null)}
              />
            ) : (
              <Tip
                tip={insert ? `Insert ${item.label}, or drag it into a field` : `Drag ${item.label} into a field, or click into one first`}
                labelsChild={false}
              >
                <button
                  type="button"
                  // Draggable even with no claimed field: dropping into one is its own way in, and needs no
                  // prior focus. Clicking still needs a target, so only that is disabled.
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(CHIP_DRAG_MIME, item.token);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  // Not `disabled`: that would block the drag too. Clicking is what needs a claimed field, so
                  // only clicking goes inert — dimmed to say so, while the chip stays draggable.
                  aria-disabled={!insert}
                  // Keep the target field's focus and selection: the insert reads its caret to know where to land.
                  // `detail > 1` is the second press of a double-click: that one is starting a rename, not
                  // asking for another copy.
                  onMouseDown={(e) => { e.preventDefault(); if (e.detail < 2) insert?.(item.token); }}
                  onDoubleClick={vocab.rename ? () => startRename(item.token) : undefined}
                  className={cn(
                    CHIP_BASE,
                    'border',
                    insert ? 'cursor-pointer hover:brightness-95' : 'cursor-grab opacity-50',
                  )}
                  style={{ backgroundColor: item.color, color: '#000' }}
                >
                  {item.label}
                </button>
              </Tip>
            )}
              </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaceholderPaletteBar;
