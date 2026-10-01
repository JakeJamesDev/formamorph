import { useMemo, useState, type ComponentPropsWithoutRef } from 'react';
import { ArrowLeft, ChevronDown, Search } from 'lucide-react';
import { MarkdownRenderer, type MarkdownComponents } from '@/components/game/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hint, Meta } from '@/components/ui/typography';
import type { DocsContentsPage } from '@/lib/docs/docsIndex';
import { readerLinkTarget, sectionBody, sectionExcerpt, withReaderLinks } from '@/lib/docs/docsReader';
import type { Guide } from '@/lib/formaquestion/guide';
import { cn } from '@/lib/utils';
import { MIN_QUERY_LENGTH } from './formaquestionTabs';

/** The most sections one search shows. */
const RESULT_LIMIT = 20;

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

export function SearchField({ value, onChange, className }: {
  value: string;
  onChange: (text: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        data-fq-autofocus=""
        type="search"
        aria-label="Search the Guide"
        placeholder="Search the guide"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Escape belongs to the dialog behind the window. Here it must not clear the field.
        onKeyDown={(event) => { if (event.key === 'Escape') event.preventDefault(); }}
        className="pl-9"
      />
    </div>
  );
}

export function SearchResults({ guide, query, onOpen, compact = false }: {
  guide: Guide;
  query: string;
  onOpen: (id: string) => void;
  /** Leaves out the excerpt, for the wide layout's rail. */
  compact?: boolean;
}) {
  const text = query.trim();
  const results = useMemo(
    () => (text.length >= MIN_QUERY_LENGTH ? guide.index.search(text, RESULT_LIMIT) : []),
    [guide, text],
  );
  if (text.length < MIN_QUERY_LENGTH) return <Hint className="p-3">Type two or more letters</Hint>;
  if (results.length === 0) return <Hint role="status" className="p-3">No sections match “{text}”</Hint>;
  return (
    <ul className="flex flex-col p-1" aria-label="Search Results">
      {results.map((section) => (
        <li key={section.id}>
          <button
            type="button"
            onClick={() => onOpen(section.id)}
            className={cn('flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground', FOCUS_RING)}
          >
            <span className="text-label font-medium">{section.label}</span>
            <Meta>{guide.titleOf(section.page)}</Meta>
            {!compact && <span className="line-clamp-2 text-helper text-muted-foreground">{sectionExcerpt(section)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The name of a section in a list under its page. The page's own heading holds its introduction. */
function rowLabel(section: DocsContentsPage['sections'][number]): string {
  return section.level <= 1 ? 'Introduction' : section.label;
}

export function ContentsList({ guide, current, onOpen }: {
  guide: Guide;
  current: string | null;
  onOpen: (id: string) => void;
}) {
  const currentPage = current === null ? null : guide.section(current)?.page ?? null;
  const [openPages, setOpenPages] = useState<ReadonlySet<string>>(new Set());
  const setPageOpen = (page: string, open: boolean) => setOpenPages((pages) => {
    const next = new Set(pages);
    if (open) next.add(page);
    else next.delete(page);
    return next;
  });
  // The page of the open section shows its sections until the player closes it.
  const [followed, setFollowed] = useState<string | null>(null);
  if (currentPage !== followed) {
    setFollowed(currentPage);
    if (currentPage !== null) setPageOpen(currentPage, true);
  }
  return (
    <nav aria-label="Guide Contents" className="flex flex-col p-3">
      {guide.contents.map(({ page, title, sections }) => (
        <Collapsible key={page} open={openPages.has(page)} onOpenChange={(open) => setPageOpen(page, open)}>
          {/* The whole row toggles. The chevron is a plain mark, so the row does not read as a button. */}
          <CollapsibleTrigger className={cn('flex min-h-8 w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-label font-medium', FOCUS_RING)}>
            <span className="min-w-0 break-words">{title}</span>
            <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', openPages.has(page) && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mb-2 flex flex-col">
            {sections.map((section) => (
              <CompactSelectionRow
                key={section.id}
                selected={current === section.id}
                onClick={() => onOpen(section.id)}
                className={cn(section.level > 2 ? 'pl-7' : 'pl-4')}
              >
                {rowLabel(section)}
              </CompactSelectionRow>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </nav>
  );
}

export function BackRow({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex shrink-0 items-center border-b px-2 py-1">
      <Button variant="link" size="sm" className="gap-1 px-1 text-foreground" onClick={onBack}>
        <ArrowLeft aria-hidden className="h-4 w-4" />
        {label}
      </Button>
    </div>
  );
}

const LINK_CLASS = cn('rounded-sm font-medium text-primary underline underline-offset-2', FOCUS_RING);

/** Link renderers for the reader: a docs link opens its section here, and every other link opens the browser. */
function readerComponents(onOpen: (id: string) => void): MarkdownComponents {
  return {
    // The link's own target and rel are left out: a docs link must not open a browser tab.
    a: ({ href, children }: ComponentPropsWithoutRef<'a'> & { node?: unknown }) => {
      const target = readerLinkTarget(href);
      if (target === null) {
        return <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>{children}</a>;
      }
      return (
        <a
          href={href}
          className={LINK_CLASS}
          onClick={(event) => {
            event.preventDefault();
            onOpen(target);
          }}
        >
          {children}
        </a>
      );
    },
  };
}

export function Reader({ guide, sectionId, onOpen }: {
  guide: Guide;
  sectionId: string;
  onOpen: (id: string) => void;
}) {
  const section = guide.section(sectionId);
  const components = useMemo(() => readerComponents(onOpen), [onOpen]);
  const body = useMemo(
    () => (section ? withReaderLinks(sectionBody(section), section.page, guide.resolve) : ''),
    [section, guide],
  );
  if (!section) return <Hint className="p-3">This section is not in the guide</Hint>;
  const siblings = guide.contents.find((entry) => entry.page === section.page)?.sections ?? [];
  const title = guide.titleOf(section.page);
  return (
    // Keyed by section, so a new section starts at its top.
    <ScrollArea key={section.id} className="min-h-0 flex-1" viewportProps={{ 'data-fq-scroll': 'reader' }}>
      <article className="flex flex-col gap-3 p-3 text-label" aria-label={`${title}: ${section.label}`}>
        {/* A page's introduction is named after the page, so the page line would repeat it. */}
        {section.label !== title && <Meta>{title}</Meta>}
        <h3 className="text-title font-semibold">{section.label}</h3>
        <div className="[&_:first-child]:mt-0">
          <MarkdownRenderer text={body} components={components} />
        </div>
        {siblings.length > 1 && (
          <div className="flex flex-col gap-1 border-t pt-3">
            <Meta>On This Page</Meta>
            {siblings.map((sibling) => (
              <CompactSelectionRow key={sibling.id} selected={sibling.id === section.id} onClick={() => onOpen(sibling.id)}>
                {rowLabel(sibling)}
              </CompactSelectionRow>
            ))}
          </div>
        )}
      </article>
    </ScrollArea>
  );
}
