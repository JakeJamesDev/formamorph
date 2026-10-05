import { useMemo } from 'react';
import { ArrowLeft, ChevronDown, Search, type LucideIcon } from 'lucide-react';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hint, Meta } from '@/components/ui/typography';
import type { DocSection, DocsContentsPage } from '@/lib/docs/docsIndex';
import { sectionBody, sectionExcerpt, withReaderLinks } from '@/lib/docs/docsReader';
import type { Guide } from '@/lib/formaquestion/guide';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { cn } from '@/lib/utils';
import { isSearchable } from './formaquestionTabs';
import { FOCUS_RING, readerComponents } from './readerLinks';

/** The most sections one search shows. */
const RESULT_LIMIT = 20;

export function SearchField({ value, onChange, takesFocus = true, className }: {
  value: string;
  onChange: (text: string) => void;
  /** The cursor goes here when the window opens. False where the question field is on show too. */
  takesFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)} {...targetAttribute('formaquestion.search', 'search-field')}>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        data-fq-autofocus={takesFocus ? '' : undefined}
        type="search"
        aria-label="Search the Guide"
        placeholder="Search the Guide"
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
  const results = useMemo(() => (isSearchable(text) ? guide.index.search(text, RESULT_LIMIT) : []), [guide, text]);
  if (!isSearchable(text)) return <Hint className="p-3">Type two or more letters</Hint>;
  if (results.length === 0) return <Hint role="status" className="p-3">No sections match “{text}”</Hint>;
  return <SectionRows guide={guide} sections={results} onOpen={onOpen} compact={compact} className="p-1" />;
}

/** Docs sections as result rows: the section, its page, and the start of its text. */
export function SectionRows({ guide, sections, onOpen, compact = false, className }: {
  guide: Guide;
  sections: readonly DocSection[];
  onOpen: (id: string) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col', className)} aria-label="Search Results">
      {sections.map((section) => (
        <li key={section.id}>
          <button
            type="button"
            onClick={() => onOpen(section.id)}
            className={cn('flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground', FOCUS_RING)}
          >
            <span className="text-label font-medium">{section.label}</span>
            <Meta>{guide.titleOf(section.page)}</Meta>
            {!compact && <Hint as="span" className="line-clamp-2">{sectionExcerpt(section)}</Hint>}
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

export function ContentsList({ guide, current, openPages, onPageOpenChange, onOpen }: {
  guide: Guide;
  current: string | null;
  /** The pages whose sections show. */
  openPages: readonly string[];
  onPageOpenChange: (page: string, open: boolean) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <nav aria-label="Guide Contents" className="flex flex-col p-3">
      {guide.contents.map(({ page, title, sections }) => (
        <Collapsible key={page} open={openPages.includes(page)} onOpenChange={(open) => onPageOpenChange(page, open)}>
          {/* The whole row toggles. The chevron is a plain mark, so the row does not read as a button. */}
          <CollapsibleTrigger className={cn('flex min-h-8 w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-label font-medium', FOCUS_RING)}>
            <span className="min-w-0 break-words">{title}</span>
            <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', openPages.includes(page) && 'rotate-180')} />
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

/** The row above a section. It goes back to where the section came from: the contents list, or the conversation. */
export function BackRow({ label, icon: Icon = ArrowLeft, onBack }: {
  label: string;
  icon?: LucideIcon;
  onBack: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center border-b px-2 py-1">
      <Button variant="link" size="sm" className="gap-1 px-1 text-foreground" onClick={onBack}>
        <Icon aria-hidden className="h-4 w-4" />
        {label}
      </Button>
    </div>
  );
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
