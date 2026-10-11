import { useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Guide } from '@/lib/formaquestion/guide';
import { isSearchable, openSectionChange, type GuideView, type GuideViewChange } from './formaquestionTabs';
import { ContentsList, GuideSearchField, SearchResults } from './GuideParts';
import { SurfaceHelpRow } from './SurfaceHelpRow';

/** The ways a Guide view changes: a section opens, the search text and the open pages change. */
export function useGuideActions(guide: Guide | null, onViewChange: (change: GuideViewChange) => void) {
  const openSection = useCallback(
    (sectionId: string) => onViewChange(openSectionChange(sectionId, guide?.section(sectionId)?.page)),
    [guide, onViewChange],
  );
  const setQuery = useCallback((query: string) => onViewChange({ query }), [onViewChange]);
  const setPageOpen = useCallback((page: string, open: boolean) => onViewChange((current) => ({
    openPages: open ? [...current.openPages, page] : current.openPages.filter((name) => name !== page),
  })), [onViewChange]);
  return { openSection, setQuery, setPageOpen };
}

/**
 * The search field, the help row and the contents or the search results, one above the other. The Wide View
 * and the full-screen Guide both put it beside the reader. It shows a part of the player's Guide view, so
 * the search text and the open pages carry over.
 */
export function GuideRail({ guide, view, onViewChange, semantic, takesFocus = true, className }: {
  guide: Guide;
  view: GuideView;
  onViewChange: (change: GuideViewChange) => void;
  /** The Semantic Search switch is on. */
  semantic: boolean;
  /** The cursor goes to the search field when the window opens. False where the question field is on show too. */
  takesFocus?: boolean;
  className?: string;
}) {
  const { openSection, setQuery, setPageOpen } = useGuideActions(guide, onViewChange);
  const searching = isSearchable(view.query);
  return (
    <div className={className}>
      <GuideSearchField value={view.query} onChange={setQuery} takesFocus={takesFocus} className="m-2 shrink-0" />
      {/* Search results take the place of the lists the row leads. */}
      {!searching && <SurfaceHelpRow guide={guide} current={view.sectionId} onOpen={openSection} />}
      <ScrollArea className="min-h-0 flex-1" viewportProps={{ 'data-fq-scroll': 'rail' }}>
        {searching
          ? <SearchResults guide={guide} query={view.query} semantic={semantic} onOpen={openSection} compact />
          : <ContentsList guide={guide} current={view.sectionId} openPages={view.openPages} onPageOpenChange={setPageOpen} onOpen={openSection} />}
      </ScrollArea>
    </div>
  );
}
