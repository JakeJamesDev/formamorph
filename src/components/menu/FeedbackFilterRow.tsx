import type { ReactNode } from "react";
import { Bug, Lightbulb, ListFilter, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { badgeVariants } from "@/components/ui/badge";
import { FeedbackSearchInput } from "@/components/menu/FeedbackSearchInput";
import { FeedbackStatusSelect } from "@/components/menu/FeedbackStatusSelect";
import type { FeedbackFilters } from "@/components/menu/useFeedbackFilters";
import {
  ANY_CATEGORY, CATEGORY_OPTIONS, FEEDBACK_SCOPES, SCOPE_LABELS, SEARCH_LABELS, SORT_LABELS, sortsFor,
} from "@/lib/feedbackPresentation";
import type {
  CategoryFilter, FeedbackScope, FeedbackSort, StaffFilterValues, UserFilterValues,
} from "@/lib/feedbackPresentation";
import { cn } from "@/lib/utils";
import type { FeedbackType } from "@/types";

// Grows to fill the row, and takes its own row below `sm`.
const SEARCH_CLASS = 'w-full flex-none sm:w-auto sm:flex-1';

function SortSelect({ type, value, onValueChange, className }: {
  type: FeedbackType;
  value: FeedbackSort;
  onValueChange: (value: FeedbackSort) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as FeedbackSort)}>
      <SelectTrigger className={cn('w-40', className)} aria-label="Sort by"><SelectValue /></SelectTrigger>
      <SelectContent>
        {sortsFor(type).map((sort) => <SelectItem key={sort} value={sort}>{SORT_LABELS[sort]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function CategorySelect({ type, value, onValueChange }: {
  type: FeedbackType;
  value: CategoryFilter;
  onValueChange: (value: CategoryFilter) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as CategoryFilter)}>
      <SelectTrigger className="w-full" aria-label="Filter by category"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY_CATEGORY}>All categories</SelectItem>
        {CATEGORY_OPTIONS[type].map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** One labeled filter inside the Filters popover. */
function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-meta font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

interface FeedbackFiltersButtonProps {
  /** The row's filter state: the badge counts its hidden changes, and Reset restores its defaults. */
  filters: Pick<FeedbackFilters<StaffFilterValues>, 'hiddenChanged' | 'anyChanged' | 'reset'>;
  /** The hidden filters, as labeled fields. */
  children: ReactNode;
}

/** The Filters button: a popover with the filters the row leaves out, and a Reset for every filter. */
function FeedbackFiltersButton({ filters, children }: FeedbackFiltersButtonProps) {
  const changed = filters.hiddenChanged;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="relative shrink-0 gap-2 px-3"
          aria-label={changed ? `More Filters, ${changed} changed` : 'More Filters'}
        >
          <ListFilter className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Filters</span>
          {changed > 0 && (
            <span
              aria-hidden
              className={cn(badgeVariants(), 'absolute -right-2 -top-2 h-5 min-w-5 justify-center px-1.5 sm:static')}
            >
              {changed}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      {/* Inline, not portaled: the tabs sit in a modal dialog whose scroll lock swallows portaled wheel scroll. */}
      <PopoverContent portal={false} align="end" collisionPadding={12} className="w-64 space-y-3">
        {children}
        <div className="h-hairline bg-border" />
        <div className="flex">
          <Button variant="ghost" size="sm" disabled={!filters.anyChanged} onClick={filters.reset}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Reset Filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface StaffFilterRowProps {
  type: FeedbackType;
  filters: FeedbackFilters<StaffFilterValues>;
}

/** The staff queue's filter row: search, Status and Sort, then Filters with Category. */
export function StaffFilterRow({ type, filters }: StaffFilterRowProps) {
  const { values, set } = filters;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <FeedbackSearchInput value={filters.search} onSearch={filters.setSearch} label={SEARCH_LABELS[type]} className={SEARCH_CLASS} />
      {/* Two equal columns on a narrow window, fixed widths beside the search otherwise. */}
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex sm:flex-none">
        <FeedbackStatusSelect type={type} value={values.status} onValueChange={set('status')} className="w-full min-w-0 sm:w-40" />
        <SortSelect type={type} value={values.sort} onValueChange={set('sort')} className="w-full min-w-0 sm:w-40" />
      </div>
      <FeedbackFiltersButton filters={filters}>
        <FilterField label="Category">
          <CategorySelect type={type} value={values.category} onValueChange={set('category')} />
        </FilterField>
      </FeedbackFiltersButton>
    </div>
  );
}

interface UserFilterRowProps {
  type: FeedbackType;
  filters: FeedbackFilters<UserFilterValues>;
  /** The file button's label. It stays the button's name when the button is icon-only. */
  fileLabel: string;
  onFile: () => void;
}

/** A profile tab's filter row: search and scope, then Filters with Status, Category and Sort, then the file button. */
export function UserFilterRow({ type, filters, fileLabel, onFile }: UserFilterRowProps) {
  const { values, set } = filters;
  const FileIcon = type === 'bug' ? Bug : Lightbulb;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <FeedbackSearchInput value={filters.search} onSearch={filters.setSearch} label={SEARCH_LABELS[type]} className={SEARCH_CLASS} />
      <Select value={values.scope} onValueChange={(next) => set('scope')(next as FeedbackScope)}>
        <SelectTrigger className="min-w-0 flex-1 sm:w-36 sm:flex-none" aria-label="Which threads"><SelectValue /></SelectTrigger>
        <SelectContent>
          {FEEDBACK_SCOPES.map((scope) => <SelectItem key={scope} value={scope}>{SCOPE_LABELS[type][scope]}</SelectItem>)}
        </SelectContent>
      </Select>
      <FeedbackFiltersButton filters={filters}>
        <FilterField label="Status">
          <FeedbackStatusSelect type={type} value={values.status} onValueChange={set('status')} className="w-full" />
        </FilterField>
        <FilterField label="Category">
          <CategorySelect type={type} value={values.category} onValueChange={set('category')} />
        </FilterField>
        <FilterField label="Sort">
          <SortSelect type={type} value={values.sort} onValueChange={set('sort')} className="w-full" />
        </FilterField>
      </FeedbackFiltersButton>
      <Button size="sm" className="shrink-0" onClick={onFile}>
        <FileIcon className="h-4 w-4" aria-hidden />
        <span className="sr-only sm:not-sr-only sm:ml-2">{fileLabel}</span>
      </Button>
    </div>
  );
}
