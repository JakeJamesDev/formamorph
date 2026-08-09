import { type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { GripVertical, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

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
  /** Transform, transition, drag opacity, and any depth indent the caller computes. */
  style?: CSSProperties;
  /** `{...attributes, ...listeners}` — applied to the grip, so only the grip starts a drag. */
  gripProps?: HTMLAttributes<HTMLElement>;
  /** Each surface words its drag affordance differently (reorder / nest / move between books). */
  gripTitle?: string;

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
  gripProps,
  gripTitle = 'Drag to reorder',
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
      style={style}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={cn(
        'p-2 cursor-pointer transition-colors flex items-center gap-1',
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
      <span
        {...gripProps}
        onClick={(e) => e.stopPropagation()}
        className={cn('shrink-0 cursor-grab touch-none px-1', chrome)}
        title={gripTitle}
      >
        <GripVertical className="h-4 w-4" />
      </span>
      {checkbox && (
        <Checkbox
          checked={checkbox.checked}
          onCheckedChange={(v) => checkbox.onChange(v === true)}
          onClick={(e) => e.stopPropagation()}
          className="mx-1 shrink-0"
          title={checkbox.checked ? 'Enabled — click to disable' : 'Disabled — click to enable'}
        />
      )}
      {icon}
      {/* Truncates rather than wrapping: a long name must never push the actions off the row. */}
      <span className={cn('min-w-0 flex-grow truncate', labelClass)}>{label}</span>
      {meta !== undefined && (
        <span
          className={cn('shrink-0 text-meta mr-1', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}
          title={metaTitle}
        >
          {meta}
        </span>
      )}
      {actions?.map((action) => (
        <Button
          key={action.title}
          variant="ghost"
          size="icon"
          className={cn('shrink-0', chrome)}
          onClick={(e) => { e.stopPropagation(); action.onClick(); }}
          title={action.title}
        >
          {action.icon}
        </Button>
      ))}
    </div>
  );
}
