/* eslint-disable react-refresh/only-export-components -- shared world-detail module: exports the
   WorldRecord type and the splitColumnClasses helper alongside its presentation components. */
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { cn } from "@/lib/utils";
import { CHIP_BASE } from "@/components/Chip";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";

// Loose shape for server/catalog world payloads, whose fields vary by endpoint and save version.
// Shared by the main menu and the Discover browser.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional dynamic-JSON bag (pending a precise interface)
export type WorldRecord = Record<string, any>;

/** Renders a timestamp as a normal date with the hour:minute:second darkened like other secondary text.
 *  Falls back to a dash when there's no value. */
export function DateTimeText({ value }: { value?: string }) {
  if (!value) return <>-</>;
  const d = new Date(value);
  return (
    <>
      {d.toLocaleDateString()}{' '}
      <span className="text-muted-foreground/60">{d.toLocaleTimeString()}</span>
    </>
  );
}

// Shared two-column layout classes for the detail modals; `collapsed` forces the single-column
// (portrait) layout regardless of viewport width.
export function splitColumnClasses(collapsed: boolean) {
  return {
    wrapper: collapsed
      ? "flex-1 min-h-0 flex flex-col gap-6 overflow-y-auto"
      : "flex-1 min-h-0 flex flex-col md:flex-row gap-6 overflow-y-auto md:overflow-hidden",
    left: collapsed
      ? ""
      : "md:w-1/2 md:min-h-0 md:overflow-y-auto md:pr-1",
    right: collapsed
      ? "border-t pt-4"
      : "md:w-1/2 md:min-h-0 md:overflow-y-auto border-t pt-4 md:border-t-0 md:pt-0 md:border-l md:pl-6",
  };
}

/** The single-column world-details layout shared by the local-world modal and the Discover details
 *  modal (where it's the left column). Order: thumbnail → actions → description → meta → tags. */
export function WorldDetailsColumn({ thumbnail, actions, description, tags, meta, split = false, collapsed = false }: {
  thumbnail: React.ReactNode;
  actions: React.ReactNode;
  description?: string;
  tags?: string[];
  meta?: React.ReactNode;
  // When set, thumbnail + actions sit in a left column and description/meta/tags in a right column.
  split?: boolean;
  // When set (with split), force the single-column layout regardless of viewport width.
  collapsed?: boolean;
}) {
  const info = (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Description</h3>
        <div className="text-gray-600 dark:text-gray-400 mt-1">
          <MarkdownRenderer text={description || "No description available."} />
        </div>
      </div>
      {meta}
      {tags && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500">Tags</h3>
          <div className="flex flex-wrap gap-2 mt-1">
            {tags.length > 0 ? (
              tags.map((tag, index) => (
                <span
                  key={index}
                  className={cn(CHIP_BASE, "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300")}
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-gray-500 text-sm">No tags</span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (split) {
    const cols = splitColumnClasses(collapsed);
    return (
      <div className={cols.wrapper}>
        <div className={cn(cols.left, "space-y-6")}>
          {thumbnail}
          {actions}
        </div>
        <div className={cols.right}>
          {info}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {thumbnail}
      {actions}
      {info}
    </div>
  );
}

// Upper bound on chips the fit loop starts from. The loop shrinks the count by one per synchronous
// re-render until the chips fit; React aborts at 50 nested synchronous updates. Two rows can never show
// this many chips, so starting here caps the iterations well under that limit with no visible change
// (over-tagged worlds still shrink to the same fitting count, then reveal the rest via "Show More").
const MAX_MEASURED_CHIPS = 40;

// Tag chips for a world card. Collapsed view shows as many chips as fit in ~4 rows with an inline
// "(Show More)" link at the end (chips that don't fit are hidden — the link never overlaps one).
// Hovering reveals the full set as an elevated overlay that floats over the layout (no reflow);
// the mouse leaving collapses it. Clicking a chip hides that tag.
export function CardTags({ tags, onHide }: { tags: string[]; onHide?: (tag: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const measuredFrom = Math.min(tags.length, MAX_MEASURED_CHIPS);
  const [count, setCount] = useState(measuredFrom); // visible chips before the link
  const [open, setOpen] = useState(false);
  const lastWidth = useRef(0);
  const truncated = count < tags.length;

  // Re-measure from scratch when the tag set changes.
  useLayoutEffect(() => { setCount(measuredFrom); }, [tags, measuredFrom]);

  // Re-measure when the available width changes (but not as our own height shrinks during fitting).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w !== lastWidth.current) { lastWidth.current = w; setCount(measuredFrom); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tags, measuredFrom]);

  // Shrink the visible chip count until the chips (+ inline link) fit within the 4-row clamp.
  // Re-runs after each setCount (and on reset) until it fits — a converging loop.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight > el.clientHeight + 1 && count > 0) setCount((c) => c - 1);
  }, [count, tags]);

  if (!tags || tags.length === 0) {
    return <span className="text-gray-400 text-xs italic">No tags</span>;
  }

  const chip = (tag: string, i: number) => (
    <span
      key={i}
      onClick={onHide ? (e) => { e.stopPropagation(); onHide(tag); } : undefined}
      title={onHide ? `Hide all worlds tagged "${tag}"` : undefined}
      className={cn(
        CHIP_BASE,
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
        onHide && "cursor-pointer hover:line-through",
      )}
    >
      {tag}
    </span>
  );

  // One wrapper owns the hover: entering opens, leaving closes. The expanded overlay is a CHILD
  // (absolutely positioned, elevated) so the whole window counts as "inside" — and it escapes the
  // card's clip (which now lives on the thumbnail) to float over the layout without reflow.
  return (
    <div
      className="relative"
      onMouseEnter={() => { if (truncated) setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
    >
      {/* ~2 rows (chip ≈ 22px + 4px gap) */}
      <div ref={ref} className="flex flex-wrap gap-1 max-h-[48px] overflow-hidden">
        {tags.slice(0, count).map(chip)}
        {truncated && (
          <span className="self-center whitespace-nowrap px-1 text-xs font-medium text-primary">
            (Show More)
          </span>
        )}
      </div>
      {truncated && open && (
        // Offset by border(1px) + p-1(4px) so the first chip lands exactly where the collapsed
        // one was — no down/right jump when it opens.
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-30 rounded-md border bg-background p-1 shadow-lg"
          style={{ top: -5, left: -5, width: 'calc(100% + 10px)' }}
        >
          <div className="flex flex-wrap gap-1">{tags.map(chip)}</div>
        </div>
      )}
    </div>
  );
}
