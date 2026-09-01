import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CHIP_BASE, ChipRenameInput } from '@/components/Chip';
import { Tip } from '@/components/ui/tooltip';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { decodePlaceholderToken } from '@/lib/placeholders';
import { placeholderCycleExclusions } from '@/lib/placeholderTree';
import { usePaletteCollapsed } from '@/lib/usePaletteCollapsed';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';
import { useChipInsertTarget } from './ChipInsertTarget';
import { CHIP_DRAG_MIME } from './ChipDrag';

/**
 * One palette of the world's placeholders for a whole editor panel, rather than an insert row on every
 * field. With a dozen placeholders and a chip editor on every name, per-field rows cost more height than
 * the fields themselves; a single strip pays that once and doubles as a reminder of what the world defines.
 *
 * Clicking a chip inserts it into the field that last held focus (see ChipInsertTarget) — clicking the
 * strip necessarily blurs that field, which is exactly why the claim outlives the blur.
 */
const PlaceholderPaletteBar = ({ placeholders, className }: {
  placeholders: Placeholder[];
  className?: string;
}) => {
  const [collapsed, setCollapsed] = usePaletteCollapsed();
  const { insert, undo, ownerId } = useChipInsertTarget();
  const vocab = usePlaceholderChipVocabulary(placeholders);
  const all = useMemo(() => vocab.palette(), [vocab]);
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
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className="flex flex-shrink-0 items-center gap-1 rounded px-1 py-0.5 text-meta text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Placeholders
          {collapsed && <span className="text-[10px] opacity-70">({items.length})</span>}
        </button>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {items.map((item) => (renaming === item.token ? (
              <ChipRenameInput
                key={item.token}
                value={item.label}
                ariaLabel={`Rename ${item.label}`}
                style={{ backgroundColor: item.color, color: '#000' }}
                onCommit={(next) => { setRenaming(null); vocab.rename?.(item.token, next); }}
                onCancel={() => setRenaming(null)}
              />
            ) : (
              <Tip
                key={item.token}
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
            )))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaceholderPaletteBar;
