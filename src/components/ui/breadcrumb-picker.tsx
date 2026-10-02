import { Fragment, useState, type ReactElement, type ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { Check, ChevronDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { selectTriggerVariants } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** One pickable row. Rows are unique by `key`, so two rows may pick the same `value`. */
export interface BreadcrumbPickerRow<V> {
  key: string;
  value: V;
  name: string;
  /** Where the row lives, outermost first. Three or more segments collapse to `First › … › Last`. */
  breadcrumb?: readonly string[];
  /** A right-aligned note that is not a location: it never collapses and has no tooltip. */
  hint?: string;
  disabled?: boolean;
}

export interface BreadcrumbPickerSection<V> {
  heading?: string;
  rows: readonly BreadcrumbPickerRow<V>[];
}

export interface BreadcrumbPickerListProps<V> {
  sections: readonly BreadcrumbPickerSection<V>[];
  /** Every row holding this value shows a check. Absent, rows have no check column. */
  value?: V;
  onPick: (value: V, row: BreadcrumbPickerRow<V>) => void;
  searchPlaceholder: string;
  /** How a name, segment or hint renders, for text that carries placeholder tokens. */
  renderText?: (text: string) => ReactNode;
  /** The plain form of that text, which the search and the tooltip read. */
  plainText?: (text: string) => string;
}

const SEPARATOR = ' › ';
const same = (text: string) => text;

// Substring over the row's shown text; the item value is the row key, which no author types.
const filterRows = (_value: string, search: string, keywords: string[] = []) =>
  (keywords.join(' ').toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0);

function Breadcrumb({ segments, render }: { segments: readonly string[]; render: (text: string) => ReactNode }) {
  const collapsed = segments.length >= 3;
  const shown = collapsed ? [segments[0], '…', segments[segments.length - 1]] : segments;
  return (
    <span className="min-w-0 flex-1 truncate text-right text-meta text-muted-foreground">
      {shown.map((segment, i) => (
        <Fragment key={i}>{i > 0 && SEPARATOR}{collapsed && i === 1 ? segment : render(segment)}</Fragment>
      ))}
    </span>
  );
}

/** The full path a row's tooltip shows and its search reads; undefined with no breadcrumb. */
const breadcrumbPath = (breadcrumb?: readonly string[], plainText: (text: string) => string = same) =>
  breadcrumb?.length ? plainText(breadcrumb.join(SEPARATOR)) : undefined;

/** A row's name and, right-aligned, where it lives. Render inside a flex row. */
export function BreadcrumbLabel({ name, breadcrumb, render = same }: {
  name: string;
  breadcrumb?: readonly string[];
  render?: (text: string) => ReactNode;
}) {
  const crumbs = breadcrumb?.length ? breadcrumb : undefined;
  return (
    <>
      {/* Beside a breadcrumb the name keeps its natural width up to 65% of the row, so it always reads. */}
      <span className={cn('min-w-0 truncate', crumbs ? 'max-w-[65%] shrink-0' : 'flex-1')}>{render(name)}</span>
      {crumbs && <Breadcrumb segments={crumbs} render={render} />}
    </>
  );
}

/** Wraps a breadcrumb row in a tooltip of its full path, which a collapsed or truncated breadcrumb hides. */
export function BreadcrumbTip({ breadcrumb, plainText, children }: {
  breadcrumb?: readonly string[];
  plainText?: (text: string) => string;
  children: ReactElement;
}) {
  const path = breadcrumbPath(breadcrumb, plainText);
  return path ? <Tip tip={path} labelsChild={false}>{children}</Tip> : children;
}

/**
 * The Breadcrumb Picker's list page: an always-shown search over every row's name and full breadcrumb, then
 * the sections in the order given. A caller page can render it under its own header.
 */
export function BreadcrumbPickerList<V>({
  sections, value, onPick, searchPlaceholder, renderText = same, plainText = same,
}: BreadcrumbPickerListProps<V>) {
  const checks = value !== undefined;
  const empty = sections.every((s) => s.rows.length === 0);

  const row = (r: BreadcrumbPickerRow<V>) => {
    const path = breadcrumbPath(r.breadcrumb, plainText);
    const checked = checks && Object.is(r.value, value);
    const item = (
      <CommandItem
        key={r.key}
        value={r.key}
        keywords={[plainText(r.name), path ?? '']}
        disabled={r.disabled}
        data-state={checks ? (checked ? 'checked' : 'unchecked') : undefined}
        className={cn('gap-2', checks && 'pl-8')}
        onSelect={() => onPick(r.value, r)}
      >
        {checks && (
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            {checked && <Check className="h-4 w-4" aria-hidden />}
          </span>
        )}
        <BreadcrumbLabel name={r.name} breadcrumb={r.breadcrumb} render={renderText} />
        {r.hint && <span className="shrink-0 text-meta text-muted-foreground">{renderText(r.hint)}</span>}
      </CommandItem>
    );
    return <BreadcrumbTip key={r.key} breadcrumb={r.breadcrumb} plainText={plainText}>{item}</BreadcrumbTip>;
  };

  return (
    <Command filter={filterRows}>
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList>
        <CommandEmpty>{empty ? 'Nothing to pick' : 'No matches'}</CommandEmpty>
        {sections.map((s, i) => s.rows.length > 0 && (
          <CommandGroup key={s.heading ?? i} heading={s.heading}>{s.rows.map(row)}</CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}

export interface BreadcrumbPickerProps<V> extends BreadcrumbPickerListProps<V> {
  /** A caller trigger, such as an outline button. Absent, a Select-style field shows the picked name. */
  trigger?: ReactElement;
  /** Replaces the list page, for a second step the caller owns. */
  page?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Off, a pick leaves the popover open, for a caller that moves to its own `page`. */
  closeOnPick?: boolean;
  /** The field trigger's prompt while nothing is picked. */
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  /** The field trigger's label, problem state and problem text, for a trigger inside a form field. */
  ariaLabelledBy?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  disabled?: boolean;
  size?: VariantProps<typeof selectTriggerVariants>['size'];
  className?: string;
  contentClassName?: string;
}

/**
 * A searchable single-select popover over world content. Each row shows its name and, right-aligned, where
 * it lives. Rows keep the order given: the caller passes them in the order of the matching editor tab.
 */
export function BreadcrumbPicker<V>({
  trigger, page, open: openProp, onOpenChange, closeOnPick = true, placeholder, id, ariaLabel, ariaLabelledBy, ariaInvalid,
  ariaDescribedBy, disabled, size,
  className, contentClassName, ...list
}: BreadcrumbPickerProps<V>) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const changeOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const pick = (value: V, row: BreadcrumbPickerRow<V>) => {
    list.onPick(value, row);
    if (closeOnPick) changeOpen(false);
  };
  const renderText = list.renderText ?? same;
  const picked = list.value === undefined
    ? undefined
    : list.sections.flatMap((s) => s.rows).find((r) => Object.is(r.value, list.value));

  return (
    <Popover open={open} onOpenChange={changeOpen} modal>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            role="combobox"
            id={id}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            disabled={disabled}
            className={cn(selectTriggerVariants({ size }), className)}
          >
            {picked
              ? <span>{renderText(picked.name)}</span>
              : <span className="text-muted-foreground">{placeholder}</span>}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className={cn(trigger ? 'w-80' : 'w-[var(--radix-popover-trigger-width)] min-w-64', 'p-0', contentClassName)}
        align="start"
        collisionBoundary={typeof document === 'undefined' ? undefined : document.documentElement}
      >
        {page ?? <BreadcrumbPickerList {...list} onPick={pick} />}
      </PopoverContent>
    </Popover>
  );
}
