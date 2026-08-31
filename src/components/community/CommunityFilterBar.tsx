import { ListFilter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/Chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tip } from "@/components/ui/tooltip";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import {
  STATUS_FACET_LABELS, availableFacets, type StatusFacet,
} from "@/lib/communityStatusFacets";

interface CommunityFilterBarProps {
  authorFilter: string[];
  setAuthorFilter: (values: string[]) => void;
  tagFilter: string[];
  setTagFilter: (values: string[]) => void;
  tagMode: 'any' | 'all';
  setTagMode: (mode: 'any' | 'all') => void;
  statusFilter: StatusFacet[];
  toggleStatus: (facet: StatusFacet) => void;
  clearFilters: () => void;
  allAuthors: string[];
  allTags: string[];
  /** Whether the reader has an account — the Liked and Mine facets need one, so without it they're absent
   *  rather than shown as controls that can only ever return nothing. */
  signedIn: boolean;
  /** Slotted in beside the filters: the separate Hidden popover. */
  children?: React.ReactNode;
  /** Sits centered on the row rather than after the filters — the collapsed event chips. */
  centered?: React.ReactNode;
  /** Sits at the far end of the row: the updates-first checkbox. */
  trailing?: React.ReactNode;
}

/**
 * Every applied narrowing in one row: status facets, authors, and tags as removable chips, with one
 * popover to add more.
 *
 * The chips are the state — an "Add filter" panel that closed on a filter the reader can't see is how a
 * grid ends up looking empty for no visible reason, and filters now survive a restart.
 */
export function CommunityFilterBar({
  authorFilter, setAuthorFilter, tagFilter, setTagFilter, tagMode, setTagMode,
  statusFilter, toggleStatus, clearFilters, allAuthors, allTags, signedIn, children,
  centered, trailing,
}: CommunityFilterBarProps) {
  const facets = availableFacets(signedIn);
  const activeCount = statusFilter.length + authorFilter.length + tagFilter.length;

  const filters = (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0 gap-1">
            <ListFilter className="h-4 w-4" />
            Add Filter
          </Button>
        </PopoverTrigger>
        {/* Focus stays on the trigger: the first field inside opens its suggestion list on focus, which
            would arrive covering the panel it was opened to show. */}
        <PopoverContent
          portal={false}
          align="start"
          side="bottom"
          className="w-80 space-y-3"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="space-y-1">
            <span className="text-meta font-medium text-muted-foreground">Status</span>
            <div className="grid grid-cols-2 gap-1">
              {facets.map((facet) => (
                <label key={facet} className="flex items-center gap-2 cursor-pointer text-label select-none">
                  <Checkbox
                    checked={statusFilter.includes(facet)}
                    onCheckedChange={() => toggleStatus(facet)}
                  />
                  {STATUS_FACET_LABELS[facet]}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-meta font-medium text-muted-foreground">Authors</span>
            <TokenAutocomplete
              values={authorFilter}
              onChange={setAuthorFilter}
              options={allAuthors}
              placeholder="author…"
              ariaLabel="Filter by author"
              openOnFocus
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-meta font-medium text-muted-foreground">Tags</span>
              <Tip tip="Toggle match: Any vs All" labelsChild={false}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-meta"
                  onClick={() => setTagMode(tagMode === 'any' ? 'all' : 'any')}
                >
                  Match {tagMode === 'any' ? 'Any' : 'All'}
                </Button>
              </Tip>
            </div>
            <TokenAutocomplete
              values={tagFilter}
              onChange={setTagFilter}
              options={allTags}
              placeholder="tag…"
              ariaLabel="Filter by tag"
              openOnFocus
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Applied filters. Tags carry the any/all mode on the chip group so what "two tags" means is read
          off the row rather than remembered from the panel. */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {statusFilter.map((facet) => (
            <Chip
              key={`status-${facet}`}
              label={STATUS_FACET_LABELS[facet]}
              removeLabel={STATUS_FACET_LABELS[facet]}
              className="border-primary/40 bg-primary/10 text-foreground"
              tip={`Status filter: ${STATUS_FACET_LABELS[facet]}`}
              onRemove={() => toggleStatus(facet)}
            />
          ))}
          {authorFilter.map((author) => (
            <Chip
              key={`author-${author}`}
              label={`by ${author}`}
              removeLabel={author}
              tip={`Author filter: ${author}`}
              onRemove={() => setAuthorFilter(authorFilter.filter((a) => a !== author))}
            />
          ))}
          {tagFilter.length > 0 && (
            <Tip tip="Toggle match: Any vs All" labelsChild={false}>
              <button
                type="button"
                onClick={() => setTagMode(tagMode === 'any' ? 'all' : 'any')}
                className="text-meta text-muted-foreground underline-offset-2 hover:underline"
              >
                {tagMode === 'any' ? 'any of' : 'all of'}
              </button>
            </Tip>
          )}
          {tagFilter.map((tag) => (
            <Chip
              key={`tag-${tag}`}
              label={`#${tag}`}
              removeLabel={tag}
              tip={`Tag filter: ${tag}`}
              onRemove={() => setTagFilter(tagFilter.filter((t) => t !== tag))}
            />
          ))}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-meta" onClick={clearFilters}>
            <RotateCcw className="h-3 w-3 mr-1" /> Clear
          </Button>
        </div>
      )}

      {children}
    </>
  );

  // Nothing to center, so the row is one wrapping line and `trailing` is pushed to the end by margin.
  if (!centered) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {filters}
        {trailing && <div className="ml-auto shrink-0">{trailing}</div>}
      </div>
    );
  }

  // Three tracks so the middle one centers on the row itself, not on the space the sides happen to
  // leave: two `1fr` tracks are equal by definition, so whatever sits between them lands on the middle
  // of the row. The sides floor at their own min-content and the middle can shrink under its, so a long
  // name in the middle gives way rather than crushing the controls it is centered between.
  return (
    <div className="grid grid-cols-[minmax(min-content,1fr)_minmax(0,auto)_minmax(min-content,1fr)] items-center gap-x-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">{filters}</div>
      <div className="flex min-w-0 justify-center">{centered}</div>
      <div className="flex min-w-0 justify-end">{trailing}</div>
    </div>
  );
}
