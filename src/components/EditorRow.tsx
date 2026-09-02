import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { GripVertical, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** px of indent per nesting level — also the horizontal drag distance that changes a row's depth. */
export const TREE_INDENT = 24;

/** The row's own left padding, in px. Nesting adds to it rather than replacing it, so a top-level tree row
 *  and a flat-list row start their content at the same place. Keep in step with `EDITOR_ROW_PADDING`. */
const ROW_PADDING_X = 8;

/** Padding and floor height, shared so a row is the same size whichever list drew it. The floor keeps a row
 *  with no actions as tall as one with them, rather than letting the icon buttons decide the height. */
const EDITOR_ROW_PADDING = 'p-2 min-h-14';

/** The space between rows. Read as row height by anyone comparing two tabs, so it belongs with the row's
 *  own metrics rather than with each list that happens to draw one. */
const EDITOR_ROW_GAP = 'flex flex-col gap-1';

/** One trailing icon button on a row (duplicate, delete, add-entry…). */
export interface EditorRowAction {
  icon: ReactNode;
  /** Tooltip and accessible name. */
  title: string;
  onClick: () => void;
}

export interface EditorRowProps {
  /** From the caller's `useSortable`. Dragging stays with the caller; this component only draws. */
  setNodeRef?: (el: HTMLElement | null) => void;
  /** Transform, transition, and drag opacity. Indent comes from `depth`, not from here. */
  style?: CSSProperties;
  /** Nesting level, for trees. Indents the row on top of its shared padding. */
  depth?: number;
  /** `{...attributes, ...listeners}` — applied to the grip, so only the grip starts a drag. */
  gripProps?: HTMLAttributes<HTMLElement>;
  /** Each surface words its drag affordance differently (reorder / nest / move between books). */
  gripTitle?: string;
  /** `false` reserves the grip's slot without drawing one, for a row that cannot be dragged. */
  grip?: boolean;

  selected: boolean;
  onSelect: () => void;

  /** 'chevron' for a collapsible row, 'spacer' to reserve the slot so siblings stay aligned. */
  lead?: 'chevron' | 'spacer';
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** aria-labels for the chevron as [expand, collapse]. */
  collapseLabels?: [string, string];

  /** The enabled toggle, where the surface offers one. */
  checkbox?: { checked: boolean; onChange: (checked: boolean) => void };
  /** Between the grip and the label (e.g. a folder glyph on group rows). */
  icon?: ReactNode;
  label: ReactNode;
  /** Extra classes on the label itself (e.g. `font-medium` on a header row). */
  labelClass?: string;
  /** Secondary text before the actions, such as a child count. */
  meta?: ReactNode;
  /** Tooltip for {@link EditorRowProps.meta}, which is usually too terse to read on its own. */
  metaTitle?: string;
  actions?: EditorRowAction[];

  /** The row heads a body attached below it, so only its top corners round. */
  attached?: boolean;
  className?: string;
}

/**
 * One row of a World Editor list: grip, optional chevron and enabled toggle, a label, optional trailing
 * meta, and icon actions. Every list and tree in the editor draws through this, so spacing, truncation,
 * and hit sizes are decided once instead of drifting per tab. Purely presentational — the caller owns its
 * own drag context and passes the sortable plumbing in.
 */
export function EditorRow({
  setNodeRef,
  style,
  depth = 0,
  gripProps,
  gripTitle = 'Drag to reorder',
  grip = true,
  selected,
  onSelect,
  lead,
  collapsed,
  onToggleCollapse,
  collapseLabels = ['Expand', 'Collapse'],
  checkbox,
  icon,
  label,
  labelClass,
  meta,
  metaTitle,
  actions,
  attached,
  className,
}: EditorRowProps) {
  // Selected rows sit on the primary fill, so their chrome has to invert with them.
  const chrome = selected ? 'text-primary-foreground' : 'text-muted-foreground';
  return (
    <div
      ref={setNodeRef}
      style={depth ? { ...style, paddingLeft: ROW_PADDING_X + depth * TREE_INDENT } : style}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      // Marks the row for anything that has to bring the selection on screen without owning the list —
      // the find bar selects an item in a tree it never rendered.
      data-editor-row-selected={selected || undefined}
      className={cn(
        EDITOR_ROW_PADDING,
        'cursor-pointer transition-colors flex items-center gap-1',
        attached ? 'rounded-t-md' : 'rounded-md',
        selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary',
        className,
      )}
    >
      {lead === 'chevron' ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(); }}
          className="shrink-0"
          aria-label={collapsed ? collapseLabels[0] : collapseLabels[1]}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      ) : lead === 'spacer' ? (
        <span className="w-4 shrink-0" aria-hidden="true" />
      ) : null}
      {/* The grip takes its tab stop from the caller's drag attributes, so it is already reachable. */}
      {grip ? (
        <Tip tip={gripTitle}>
          <span
            {...gripProps}
            onClick={(e) => e.stopPropagation()}
            className={cn('shrink-0 cursor-grab touch-none px-1', chrome)}
          >
            <GripVertical className="h-4 w-4" />
          </span>
        </Tip>
      ) : (
        <span className="w-6 shrink-0" aria-hidden="true" />
      )}
      {checkbox && (
        <Tip tip={checkbox.checked ? 'Enabled — click to disable' : 'Disabled — click to enable'}>
          <Checkbox
            checked={checkbox.checked}
            onCheckedChange={(v) => checkbox.onChange(v === true)}
            onClick={(e) => e.stopPropagation()}
            className="mx-1 shrink-0"
          />
        </Tip>
      )}
      {icon}
      {/* Truncates rather than wrapping: a long name must never push the actions off the row. */}
      <span className={cn('min-w-0 flex-grow truncate', labelClass)}>{label}</span>
      {meta !== undefined && (
        // The meta is the one place a row says something only a tip spells out, so it takes a tab stop of
        // its own — and only while it has a tip to give.
        <Tip tip={metaTitle} labelsChild={false}>
          <span
            tabIndex={metaTitle ? 0 : undefined}
            className={cn('shrink-0 text-meta mr-1', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}
          >
            {meta}
          </span>
        </Tip>
      )}
      {actions?.map((action) => (
        <Tip key={action.title} tip={action.title}>
          <Button
            variant="ghost"
            size="icon"
            className={cn('shrink-0', chrome)}
            onClick={(e) => { e.stopPropagation(); action.onClick(); }}
          >
            {action.icon}
          </Button>
        </Tip>
      ))}
    </div>
  );
}

/**
 * The column an editor list's rows sit in. Trees used to render their rows with no wrapper at all, so they
 * were flush while the flat lists were spaced 8px apart — the same row read as a different height depending
 * on the tab. Wrapping both in this keeps one answer.
 */
export const EditorRowList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  // The ref is forwarded because a list can also be a drop target (the Dictionary's zones).
  ({ children, className, ...props }, ref) => (
    <div ref={ref} className={cn(EDITOR_ROW_GAP, className)} {...props}>{children}</div>
  ),
);
EditorRowList.displayName = 'EditorRowList';
