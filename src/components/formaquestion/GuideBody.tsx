import { useCallback } from 'react';
import { BookOpen, MessageCircleQuestion, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SurfaceRoute } from '@/lib/surface/surfaceRoute';
import type { Guide } from '@/lib/formaquestion/guide';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { AskPanel } from './AskParts';
import { FORMAQUESTION_TABS, conversationChange, isSearchable, type FormaquestionTab, type GuideView, type GuideViewChange } from './formaquestionTabs';
import { BackRow, ContentsList, GuideSearchField, GuideUnavailable, Reader, SearchResults } from './GuideParts';
import { GuideRail, useGuideActions } from './GuideRail';
import { SurfaceHelpRow } from './SurfaceHelpRow';
import type { HelpChat } from './useHelpChat';

const TAB_ICONS: Record<FormaquestionTab, typeof Search> = { ask: MessageCircleQuestion, search: Search, guide: BookOpen };
const TAB_PANEL = 'mt-0 min-h-0 flex-1 flex-col data-[state=active]:flex';

/**
 * The window's content: one design at two widths. Narrow shows one part at a time behind tabs. Wide keeps
 * a rail with search and contents beside the conversation or the reader. The search text, the open section
 * and the conversation carry over.
 */
export function GuideBody({ guide, failed, onRetry, view, onViewChange, wide, chat, settings, onSettingsChange, onGo }: {
  /** Null until the docs load. */
  guide: Guide | null;
  failed: boolean;
  onRetry: () => void;
  view: GuideView;
  onViewChange: (change: GuideViewChange) => void;
  wide: boolean;
  chat: HelpChat;
  settings: HelpSettings;
  onSettingsChange: (change: HelpSettingsChange) => void;
  /** Opens the surface an answer's Take Me There names. */
  onGo: (route: SurfaceRoute) => void;
}) {
  const { openSection, setQuery, setPageOpen } = useGuideActions(guide, onViewChange);
  const setDraft = useCallback((draft: string) => onViewChange({ draft }), [onViewChange]);
  const helpRow = guide && <SurfaceHelpRow guide={guide} current={view.sectionId} onOpen={openSection} />;
  // Search results take the place of the lists the row leads.
  const helpRowUnlessSearching = !isSearchable(view.query) && helpRow;

  if (!guide) return <GuideUnavailable failed={failed} onRetry={onRetry} />;

  const ask = <AskPanel guide={guide} chat={chat} settings={settings} onSettingsChange={onSettingsChange} draft={view.draft} onDraftChange={setDraft} onOpen={openSection} onGo={onGo} />;

  if (wide) {
    // The pane shows the conversation until a section opens, and again after Back to Conversation.
    const showsReader = view.sectionId !== null && view.tab !== 'ask';
    return (
      <div className="flex h-full min-h-0" data-fq-layout="wide">
        <GuideRail guide={guide} view={view} onViewChange={onViewChange} semantic={settings.sources.semantic} takesFocus={showsReader} className="flex min-h-0 w-56 shrink-0 flex-col border-r" />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showsReader && view.sectionId ? (
            <>
              <BackRow label="Back to Conversation" icon={MessageCircleQuestion} onBack={() => onViewChange(conversationChange())} />
              <Reader guide={guide} sectionId={view.sectionId} onOpen={openSection} />
            </>
          ) : ask}
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
        <TabsList className="grid w-full grid-cols-3" aria-label="Formaquestion Parts">
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
      <TabsContent value="ask" className={TAB_PANEL}>{ask}</TabsContent>
      <TabsContent value="search" className={TAB_PANEL}>
        <GuideSearchField value={view.query} onChange={setQuery} className="m-3 mb-1 shrink-0" />
        {helpRowUnlessSearching}
        <ScrollArea className="min-h-0 flex-1" viewportProps={{ 'data-fq-scroll': 'results' }}>
          <SearchResults guide={guide} query={view.query} semantic={settings.sources.semantic} onOpen={openSection} />
        </ScrollArea>
      </TabsContent>
      <TabsContent value="guide" className={TAB_PANEL}>
        {view.sectionId && view.reading ? (
          <>
            <BackRow label="Contents" onBack={() => onViewChange({ reading: false })} />
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
