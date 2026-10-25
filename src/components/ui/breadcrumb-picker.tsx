import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { Check, ChevronDown, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { selectTriggerVariants } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import { useStableCallback } from '@/lib/useStableCallback';
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

/** A drill page: a row that opens its children under a header naming the path. */
export interface BreadcrumbPickerPage<V> {
  kind: 'page';
  key: string;
  /** The page row's name and its header segment. A row's breadcrumb drops a leading segment equal to it. */
  heading: string;
  children: readonly BreadcrumbPickerNode<V>[];
}

/** A leaf of the drill tree. Its heading also groups its rows in the flat list. */
export interface BreadcrumbPickerLeaf<V> extends BreadcrumbPickerSection<V> {
  kind: 'section';
}

export type BreadcrumbPickerNode<V> = BreadcrumbPickerPage<V> | BreadcrumbPickerLeaf<V>;

/** A tree with more leaf rows than this opens on its root page; a smaller one shows the flat list. */
const DRILL_CUTOFF = 15;

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

type ListItem<V> =
  | { kind: 'row'; row: BreadcrumbPickerRow<V>; breadcrumb?: readonly string[] }
  | { kind: 'page'; page: BreadcrumbPickerPage<V>; count: number };

interface ListGroup<V> {
  key: string;
  heading?: string;
  items: ListItem<V>[];
}

const rowItem = <V,>(row: BreadcrumbPickerRow<V>, breadcrumb = row.breadcrumb): ListItem<V> => ({ kind: 'row', row, breadcrumb });

/** The search field and grouped rows every list page renders. The search is uncontrolled without `search`. */
function PickerCommand<V>({
  groups, value, onPick, onOpenPage, searchPlaceholder, renderText, plainText, search, onSearch, onInputKeyDown, focusOnMount,
}: Omit<BreadcrumbPickerListProps<V>, 'sections'> & {
  groups: readonly ListGroup<V>[];
  onOpenPage?: (key: string) => void;
  search?: string;
  onSearch?: (search: string) => void;
  onInputKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  focusOnMount?: boolean;
}) {
  const render = renderText ?? same;
  const plain = plainText ?? same;
  const checks = value !== undefined;
  const empty = groups.every((g) => g.items.length === 0);
  const inputRef = useRef<HTMLInputElement>(null);
  // A drill step remounts this list; the search keeps the keyboard's place.
  useEffect(() => { if (focusOnMount) inputRef.current?.focus(); }, [focusOnMount]);
  const pickRow = useStableCallback(onPick);
  const openPage = useStableCallback((key: string) => onOpenPage?.(key));

  // Rows render once per list, not per keystroke: cmdk filters them itself, so typing re-renders only the input.
  const rows = useMemo(() => {
    const item = (entry: ListItem<V>) => {
      if (entry.kind === 'page') {
        const { page, count } = entry;
        return (
          <CommandItem
            key={`page:${page.key}`}
            value={`page:${page.key}`}
            aria-label={`${plain(page.heading)}, ${count} available, opens a page`}
            className={cn('gap-2', checks && 'pl-8')}
            onSelect={() => openPage(page.key)}
          >
            <span className="min-w-0 flex-1 truncate">{render(page.heading)}</span>
            <span className="shrink-0 text-meta text-muted-foreground">{count}</span>
            <span aria-hidden className="shrink-0 text-muted-foreground">›</span>
          </CommandItem>
        );
      }
      const { row: r, breadcrumb } = entry;
      const path = breadcrumbPath(breadcrumb, plain);
      const checked = checks && Object.is(r.value, value);
      const cmdItem = (
        <CommandItem
          key={r.key}
          value={r.key}
          keywords={[plain(r.name), path ?? '']}
          disabled={r.disabled}
          data-state={checks ? (checked ? 'checked' : 'unchecked') : undefined}
          className={cn('gap-2', checks && 'pl-8')}
          onSelect={() => pickRow(r.value, r)}
        >
          {checks && (
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
              {checked && <Check className="h-4 w-4" aria-hidden />}
            </span>
          )}
          <BreadcrumbLabel name={r.name} breadcrumb={breadcrumb} render={render} />
          {r.hint && <span className="shrink-0 text-meta text-muted-foreground">{render(r.hint)}</span>}
        </CommandItem>
      );
      return <BreadcrumbTip key={r.key} breadcrumb={breadcrumb} plainText={plain}>{cmdItem}</BreadcrumbTip>;
    };
    return groups.map((g) => g.items.length > 0 && (
      <CommandGroup key={g.key} heading={g.heading}>{g.items.map(item)}</CommandGroup>
    ));
  }, [groups, value, checks, render, plain, pickRow, openPage]);

  return (
    <Command filter={filterRows}>
      <CommandInput ref={inputRef} placeholder={searchPlaceholder} value={search} onValueChange={onSearch} onKeyDown={onInputKeyDown} />
      <CommandList>
        <CommandEmpty>{empty ? 'Nothing to pick' : 'No matches'}</CommandEmpty>
        {rows}
      </CommandList>
    </Command>
  );
}

/**
 * The Breadcrumb Picker's list page: an always-shown search over every row's name and full breadcrumb, then
 * the sections in the order given. A caller page can render it under its own header.
 */
export function BreadcrumbPickerList<V>({ sections, ...list }: BreadcrumbPickerListProps<V>) {
  const groups = sections.map((s, i) => ({ key: s.heading ?? String(i), heading: s.heading, items: s.rows.map((r) => rowItem(r)) }));
  return <PickerCommand groups={groups} {...list} />;
}

const isPage = <V,>(node: BreadcrumbPickerNode<V>): node is BreadcrumbPickerPage<V> => node.kind === 'page';
const leaves = <V,>(nodes: readonly BreadcrumbPickerNode<V>[]): BreadcrumbPickerRow<V>[] =>
  nodes.flatMap((n) => (isPage(n) ? leaves(n.children) : n.rows));

/** What one drill step shows: its nodes and the headings of the pages it sits under. */
interface Level<V> {
  nodes: readonly BreadcrumbPickerNode<V>[];
  path: readonly string[];
}

/** Opens straight through a level whose only choice is a page, keeping that page in the path. */
const enter = <V,>(nodes: readonly BreadcrumbPickerNode<V>[], path: readonly string[]): Level<V> => {
  const shown = nodes.filter((n) => leaves([n]).length > 0);
  const only = shown.length === 1 ? shown[0] : undefined;
  return only && isPage(only) && leaves(only.children).length > 1
    ? enter(only.children, [...path, only.heading])
    : { nodes, path };
};

/** The level the opened page keys lead to. `depth` counts the keys that still name a page. */
const openLevel = <V,>(tree: readonly BreadcrumbPickerNode<V>[], keys: readonly string[]) => {
  let level = enter(tree, []);
  let depth = 0;
  for (const key of keys) {
    const page = level.nodes.find((n): n is BreadcrumbPickerPage<V> => isPage(n) && n.key === key);
    if (!page || leaves(page.children).length < 2) break;
    level = enter(page.children, [...level.path, page.heading]);
    depth += 1;
  }
  return { ...level, depth };
};

/** A breadcrumb without the leading segments the open path already names. */
const dropShown = (breadcrumb: readonly string[] | undefined, path: readonly string[]) => {
  let at = 0;
  for (const heading of path) if (breadcrumb?.[at] === heading) at += 1;
  return breadcrumb?.slice(at);
};

const levelRow = <V,>(row: BreadcrumbPickerRow<V>, path: readonly string[]) => rowItem(row, dropShown(row.breadcrumb, path));

/** On a page, a lone group's heading only repeats the header. */
const headed = <V,>(groups: ListGroup<V>[], path: readonly string[]) =>
  (path.length > 0 && groups.length < 2 ? groups.map((g) => ({ ...g, heading: undefined })) : groups);

/** Every leaf row under the level, grouped by its section heading or else its root category's heading. */
const flatGroups = <V,>({ nodes, path }: Level<V>) => {
  const groups: ListGroup<V>[] = [];
  const walk = (list: readonly BreadcrumbPickerNode<V>[], fallback?: string) => {
    for (const n of list) {
      if (isPage(n)) {
        walk(n.children, fallback ?? n.heading);
        continue;
      }
      if (!n.rows.length) continue;
      const heading = n.heading ?? fallback;
      const items = n.rows.map((r) => levelRow(r, path));
      const last = groups.at(-1);
      if (last && last.heading === heading) last.items.push(...items);
      else groups.push({ key: `flat:${groups.length}`, heading, items });
    }
  };
  walk(nodes, path[0]);
  return headed(groups, path);
};

/** The titles of the pages above a page's one row, outermost first. */
const loneTitles = <V,>(page: BreadcrumbPickerPage<V>): string[] => {
  const next = page.children.find((n) => leaves([n]).length > 0);
  return [page.heading, ...(next && isPage(next) ? loneTitles(next) : [])];
};

/** A lone row lifted onto its parent: the titles of the pages it skipped lead its breadcrumb, unless it starts with them. */
const liftedRow = <V,>(row: BreadcrumbPickerRow<V>, page: BreadcrumbPickerPage<V>, path: readonly string[]) => {
  const crumb = dropShown(row.breadcrumb, path) ?? [];
  const titles = loneTitles(page);
  // A page named for its one row, such as "Time of Day", adds nothing before it.
  if (titles.at(-1) === row.name) titles.pop();
  const starts = titles.every((t, i) => crumb[i] === t);
  return rowItem(row, starts ? crumb : [...titles, ...crumb]);
};

/** The level's own rows: a row per page, a lone-row page as that row, and each section's rows. */
const browseGroups = <V,>({ nodes, path }: Level<V>) => {
  const groups: ListGroup<V>[] = [];
  let loose: ListItem<V>[] | null = null;
  for (const [i, n] of nodes.entries()) {
    if (!isPage(n)) {
      loose = null;
      if (n.rows.length) groups.push({ key: `section:${i}`, heading: n.heading, items: n.rows.map((r) => levelRow(r, path)) });
      continue;
    }
    const rows = leaves(n.children);
    if (!rows.length) continue;
    if (!loose) {
      loose = [];
      groups.push({ key: `pages:${i}`, items: loose });
    }
    loose.push(rows.length === 1
      ? liftedRow(rows[0], n, path)
      : { kind: 'page', page: n, count: rows.filter((r) => !r.disabled).length });
  }
  return headed(groups, path);
};

/** A page's header: a back arrow when `onBack` is given, then the title. */
export function BreadcrumbPickerHeader({ backLabel = 'Back', onBack, children }: {
  backLabel?: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center gap-1 border-b px-2 py-1.5 text-label">
      {onBack && (
        <Button type="button" variant="ghost" size="xs" className="h-7 w-7 shrink-0 p-0" aria-label={backLabel} onClick={onBack}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
      )}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

/** One open level, root first: the page key that opened it and its own search. */
interface DrillFrame {
  key: string;
  search: string;
}

const ROOT: readonly DrillFrame[] = [{ key: '', search: '' }];
const KEY_SEPARATOR = '\u0000';

function BreadcrumbPickerTree<V>({ tree, frames, onFrames, ...list }: Omit<BreadcrumbPickerListProps<V>, 'sections'> & {
  tree: readonly BreadcrumbPickerNode<V>[];
  frames: readonly DrillFrame[];
  onFrames: (frames: readonly DrillFrame[]) => void;
}) {
  const drill = useMemo(() => leaves(tree).length > DRILL_CUTOFF, [tree]);
  // The open pages as one value, so typing, which changes only a frame's search, keeps the level and its rows.
  const keyPath = frames.slice(1).map((f) => f.key).join(KEY_SEPARATOR);
  const level = useMemo(() => (drill
    ? openLevel(tree, keyPath ? keyPath.split(KEY_SEPARATOR) : [])
    : { nodes: tree, path: [], depth: 0 }), [tree, drill, keyPath]);
  const { depth } = level;
  const keys = frames.slice(1).map((f) => f.key);
  const open = frames.slice(0, depth + 1);
  const search = open[depth].search;
  const browse = drill && search === '';
  const groups = useMemo(() => (browse ? browseGroups(level) : flatGroups(level)), [browse, level]);
  const setSearch = (next: string) => onFrames([...open.slice(0, -1), { ...open[depth], search: next }]);
  const openPage = (key: string) => onFrames([...open, { key, search: '' }]);
  const back = () => onFrames(open.slice(0, -1));
  const backKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Backspace' || search !== '' || depth === 0) return;
    event.preventDefault();
    back();
  };
  const renderText = list.renderText ?? same;

  return (
    <div>
      {level.path.length > 0 && (
        <BreadcrumbPickerHeader onBack={depth > 0 ? back : undefined}>
          {level.path.map((heading, i) => <Fragment key={i}>{i > 0 && SEPARATOR}{renderText(heading)}</Fragment>)}
        </BreadcrumbPickerHeader>
      )}
      <PickerCommand
        key={keys.slice(0, depth).join('\n')}
        groups={groups}
        search={search}
        onSearch={setSearch}
        onOpenPage={openPage}
        onInputKeyDown={backKey}
        focusOnMount
        {...list}
      />
    </div>
  );
}

interface BreadcrumbPickerOptions<V> extends Omit<BreadcrumbPickerListProps<V>, 'sections'> {
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

export type BreadcrumbPickerProps<V> = BreadcrumbPickerOptions<V> & (
  | { sections: readonly BreadcrumbPickerSection<V>[]; tree?: undefined }
  | {
    /** Pages to drill through once the tree holds more than 15 rows; the root search stays flat. */
    tree: readonly BreadcrumbPickerNode<V>[];
    sections?: undefined;
  }
);

/**
 * A searchable single-select popover over world content. Each row shows its name and, right-aligned, where
 * it lives. Rows keep the order given: the caller passes them in the order of the matching editor tab.
 */
export function BreadcrumbPicker<V>({
  trigger, page, open: openProp, onOpenChange, closeOnPick = true, placeholder, id, ariaLabel, ariaLabelledBy, ariaInvalid,
  ariaDescribedBy, disabled, size,
  className, contentClassName, sections, tree, ...list
}: BreadcrumbPickerProps<V>) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  // Every opening starts at the root; a pick or a caller page leaves the open page as it is.
  const [frames, setFrames] = useState(ROOT);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFrames(ROOT);
  }
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
    : (tree ? leaves(tree) : (sections ?? []).flatMap((s) => s.rows)).find((r) => Object.is(r.value, list.value));

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
        {page ?? (tree
          ? <BreadcrumbPickerTree tree={tree} frames={frames} onFrames={setFrames} {...list} onPick={pick} />
          : <BreadcrumbPickerList sections={sections ?? []} {...list} onPick={pick} />)}
      </PopoverContent>
    </Popover>
  );
}
