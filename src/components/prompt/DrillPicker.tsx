import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { CHIP_BASE } from '@/components/Chip';
import { Input } from '@/components/ui/input';
import { useWheelScroll } from '@/lib/useWheelScroll';
import { cn } from '@/lib/utils';
import type { ChipRow, ChipVocabulary } from '@/lib/chipVocabulary';

/**
 * Re-aim a placed chip by walking what its family holds. Two kinds of step are on offer and they resolve
 * differently: a part names one branch and always takes it, while a slot names something by name and routes
 * through whichever value the level rolls — so a slot one value cannot supply is marked, because that roll
 * resolves to nothing. Values that are not a chip are addressable by nothing, and are counted rather than
 * listed.
 *
 * Opened from a chip's pop-out, seeded at the path that chip already carries: the level it stands on is what
 * the picker shows first, and its trail is the way back out.
 */

/** One offered row: the chip it stands for, and the walk it opens. A slot opens none — it names no one
 *  target until a roll picks it — so it comes with no `onDrill`. */
function PickerRow({ row, marker, onPick, onDrill }: {
  row: ChipRow;
  marker?: string;
  onPick: () => void;
  onDrill?: () => void;
}) {
  return (
    <div className="flex items-center rounded hover:bg-accent">
      <button
        type="button"
        data-testid="drill-picker-row"
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1 text-left text-label"
      >
        <span className={cn(CHIP_BASE, 'border')} style={{ backgroundColor: row.color, color: '#000' }}>
          {row.label}
        </span>
        {marker && (
          <span className="flex min-w-0 items-center gap-1 text-meta text-warning">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{marker}</span>
          </span>
        )}
      </button>
      {onDrill && (
        <button
          type="button"
          aria-label={`Show ${row.label} Parts`}
          onClick={onDrill}
          className="shrink-0 px-1.5 py-1 text-label text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden>›</span>
        </button>
      )}
    </div>
  );
}

const DrillPicker = ({ vocab, token, onPick }: {
  vocab: ChipVocabulary;
  /** The chip being re-aimed. The picker opens on the level its path lands on. */
  token: string;
  /** The token the author settled on. Its mode and placement are the caller's to keep. */
  onPick: (token: string) => void;
}) => {
  // The level being shown, or null for the whole family. The seed is the end of the chip's own trail rather
  // than the chip's token: a path the family cannot walk to the end — a slot, or a deleted part — describes
  // the level that offered the step it stopped on, which is where re-aiming that chip belongs. A chip whose
  // root is gone describes nothing, and opens on the family.
  const [at, setAt] = useState<string | null>(() => vocab.structure?.(token)?.trail.at(-1)?.token ?? null);
  const [filter, setFilter] = useState('');
  const scroller = useWheelScroll<HTMLDivElement>();

  const structure = at ? vocab.structure?.(at) ?? null : null;
  const parts = at ? vocab.drill?.(at) ?? [] : vocab.palette();
  const match = (label: string) => label.toLowerCase().includes(filter.trim().toLowerCase());
  const rows = parts.filter((r) => match(r.label));
  const slots = (structure?.slots ?? []).filter((s) => match(s.label));
  // Offered at the root only, exactly as the `{` menu offers it: inside a level a new placeholder is no part
  // of that level, so aiming the chip at one would silently drop the path the author walked.
  const newName = vocab.create && !at ? filter.trim() : '';

  /** Walk to a level, or out to the family. Each level is searched on its own terms, so the filter goes. */
  const walk = (next: string | null) => {
    setAt(next);
    setFilter('');
  };

  const create = () => {
    const made = vocab.create?.(newName);
    if (made) onPick(made);
  };

  return (
    <div data-testid="drill-picker" className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-1 text-meta text-muted-foreground">
        <button
          type="button"
          onClick={() => walk(null)}
          className={cn('rounded px-1 py-0.5 hover:bg-accent hover:text-foreground', !at && 'text-foreground')}
        >
          All Placeholders
        </button>
        {structure?.trail.map((crumb, i) => (
          <span key={crumb.token} className="flex items-center gap-1">
            <span aria-hidden>›</span>
            <button
              type="button"
              onClick={() => walk(crumb.token)}
              className={cn(
                'truncate rounded px-1 py-0.5 hover:bg-accent hover:text-foreground',
                i === (structure.trail.length - 1) && 'text-foreground',
              )}
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </div>
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label={at ? 'Filter Parts' : 'Filter Placeholders'}
        placeholder="Filter…"
        className="h-7 text-label"
      />
      <div ref={scroller} className="max-h-56 space-y-2 overflow-y-auto">
        {!!rows.length && (
          <div>
            <p className="px-1.5 text-meta font-medium">{structure?.partsLabel ?? 'Placeholders'}</p>
            {rows.map((row) => (
              <PickerRow
                key={row.token}
                row={row}
                onPick={() => onPick(row.token)}
                onDrill={(vocab.drill?.(row.token) ?? []).length ? () => walk(row.token) : undefined}
              />
            ))}
          </div>
        )}
        {!!slots.length && (
          <div>
            <p className="px-1.5 text-meta font-medium">Slots</p>
            <p className="px-1.5 text-meta text-muted-foreground">Reached through whichever value rolls.</p>
            {slots.map((slot) => (
              <PickerRow
                key={slot.token}
                row={slot}
                marker={slot.partial ? 'not in every value' : undefined}
                onPick={() => onPick(slot.token)}
              />
            ))}
          </div>
        )}
        {!rows.length && !slots.length && !newName && (
          <p className="px-1.5 py-1 text-helper text-muted-foreground">No parts match.</p>
        )}
      </div>
      {!!structure?.plain && (
        <p className="px-1.5 text-meta text-muted-foreground">
          {structure.plain === 1 ? '1 plain value' : `${structure.plain} plain values`} — not addressable.
        </p>
      )}
      {!!newName && (
        <button
          type="button"
          data-testid="drill-picker-create"
          onClick={create}
          className="flex w-full items-center gap-2 rounded border-t border-border px-1.5 py-1 text-left text-label hover:bg-accent"
        >
          <span aria-hidden>+</span>
          <span className="truncate">{`New Placeholder "${newName}"`}</span>
        </button>
      )}
    </div>
  );
};

export default DrillPicker;
