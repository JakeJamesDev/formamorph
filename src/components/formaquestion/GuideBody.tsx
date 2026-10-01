import { useCallback } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hint } from '@/components/ui/typography';
import type { Guide } from '@/lib/formaquestion/guide';
import {
  FORMAQUESTION_TABS, isSearchable, type FormaquestionTab, type GuideView, type GuideViewChange,
} from './formaquestionTabs';
import { BackRow, ContentsList, Reader, SearchField, SearchResults } from './GuideParts';
import { SurfaceHelpRow } from './SurfaceHelpRow';

const TAB_ICONS: Record<FormaquestionTab, typeof Search> = { search: Search, guide: BookOpen };
const TAB_PANEL = 'mt-0 min-h-0 flex-1 flex-col data-[state=active]:flex';

/**
 * The window's content: one design at two widths. Narrow shows one part at a time behind tabs. Wide keeps
 * a rail with search and contents beside the reader. The search text and the open section carry over.
 */
export function GuideBody({ guide, failed, onRetry, view, onViewChange, wide }: {
  /** Null until the docs load. */
  guide: Guide | null;
  failed: boolean;
  onRetry: () => void;
  view: GuideView;
  onViewChange: (change: GuideViewChange) => void;
  wide: boolean;
}) {
  // The tab follows the reader, so a swap to narrow lands on the section that is open.
  // Its page opens in the contents list, and stays open until the player closes it.
  const openSection = useCallback((sectionId: string) => onViewChange((current) => {
    const page = guide?.section(sectionId)?.page;
    const openPages = page === undefined || current.openPages.includes(page) ? current.openPages : [...current.openPages, page];
    return { sectionId, tab: 'guide', reading: true, openPages };
  }), [guide, onViewChange]);
  const setQuery = (query: string) => onViewChange({ query });
  const setPageOpen = (page: string, open: boolean) => onViewChange((current) => ({
    openPages: open ? [...current.openPages, page] : current.openPages.filter((name) => name !== page),
  }));
  const helpRow = guide && <SurfaceHelpRow guide={guide} current={view.sectionId} onOpen={openSection} />;
  // Search results take the place of the lists the row leads.
  const helpRowUnlessSearching = !isSearchable(view.query) && helpRow;

  if (!guide) {
    return failed ? (
      <div role="alert" className="flex flex-col items-start gap-2 p-3">
        <Hint>The guide did not load</Hint>
        <Button variant="outline" size="sm" onClick={onRetry}>Try Again</Button>
      </div>
    ) : (
      <Hint role="status" className="p-3">Loading the guide…</Hint>
    );
  }

  if (wide) {
    return (
      <div className="flex h-full min-h-0" data-fq-layout="wide">
        <div className="flex min-h-0 w-56 shrink-0 flex-col border-r">
          <SearchField value={view.query} onChange={setQuery} className="m-2 shrink-0" />
          {helpRowUnlessSearching}
          <ScrollArea className="min-h-0 flex-1" viewportProps={{ 'data-fq-scroll': 'rail' }}>
            {isSearchable(view.query)
              ? <SearchResults guide={guide} query={view.query} onOpen={openSection} compact />
              : <ContentsList guide={guide} current={view.sectionId} openPages={view.openPages} onPageOpenChange={setPageOpen} onOpen={openSection} />}
          </ScrollArea>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {view.sectionId
            ? <Reader guide={guide} sectionId={view.sectionId} onOpen={openSection} />
            : <Hint className="p-6 text-center">Select a section to read it here</Hint>}
        </div>
      </div>
    );
  }

  return (
    <Tabs
      value={view.tab}
      onValueChange={(tab) => onViewChange({ tab: tab as FormaquestionTab })}
      className="flex h-full min-h-0 flex-col"
      data-fq-layout="narrow"
    >
      <div className="shrink-0 border-b p-2">
        <TabsList className="grid w-full grid-cols-2" aria-label="Formaquestion Parts">
          {FORMAQUESTION_TABS.map(({ value, label }) => {
            const Icon = TAB_ICONS[value];
            return (
              <TabsTrigger key={value} value={value} className="gap-1.5">
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
      <TabsContent value="search" className={TAB_PANEL}>
        <SearchField value={view.query} onChange={setQuery} className="m-3 mb-1 shrink-0" />
        {helpRowUnlessSearching}
        <ScrollArea className="min-h-0 flex-1" viewportProps={{ 'data-fq-scroll': 'results' }}>
          <SearchResults guide={guide} query={view.query} onOpen={openSection} />
        </ScrollArea>
      </TabsContent>
      <TabsContent value="guide" className={TAB_PANEL}>
        {view.sectionId && view.reading ? (
          <>
            <BackRow onBack={() => onViewChange({ reading: false })} />
            <Reader guide={guide} sectionId={view.sectionId} onOpen={openSection} />
          </>
        ) : (
          <>
            {helpRow}
            <ScrollArea className="min-h-0 flex-1" viewportProps={{ 'data-fq-scroll': 'contents' }}>
              <ContentsList guide={guide} current={view.sectionId} openPages={view.openPages} onPageOpenChange={setPageOpen} onOpen={openSection} />
            </ScrollArea>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
