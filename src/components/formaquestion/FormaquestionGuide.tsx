import { BookOpen, ExternalLink } from 'lucide-react';
import { FullscreenShell, FULLSCREEN_CORNER_CLEAR } from '@/components/FullscreenShell';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import type { Guide } from '@/lib/formaquestion/guide';
import { cn } from '@/lib/utils';
import type { MorphFullscreen } from '@/lib/useMorphFullscreen';
import type { GuideView, GuideViewChange } from './formaquestionTabs';
import { BackRow, Reader, GuideUnavailable } from './GuideParts';
import { ReaderHistoryButtons } from './ReaderHistoryButtons';
import { GuideRail, useGuideActions } from './GuideRail';

/**
 * The Guide full screen: the rail with the search field and the contents beside the reader. It draws the
 * Guide view the help window holds, so a section opened in either shows in both.
 *
 * The mobile screen has room for one part, so it shows the contents, or the open section behind a back row.
 */
export function FormaquestionGuide({ morph, guide, failed, onRetry, view, onViewChange, onStep, onOpenWiki, semantic, sheet }: {
  morph: MorphFullscreen;
  /** Null until the docs load. */
  guide: Guide | null;
  failed: boolean;
  onRetry: () => void;
  view: GuideView;
  onViewChange: (change: GuideViewChange) => void;
  /** Moves the reader's history, passing over entries the full screen cannot show. */
  onStep: (delta: -1 | 1) => void;
  /** Opens the wiki on the section the reader shows. */
  onOpenWiki: () => void;
  /** The Semantic Search switch is on. */
  semantic: boolean;
  /** The mobile screen. */
  sheet: boolean;
}) {
  const { openSection } = useGuideActions(guide, onViewChange);
  const open = guide && view.sectionId ? guide.section(view.sectionId) ?? null : null;
  return (
    <FullscreenShell morph={morph} title="Guide" closes className="gap-2">
      <header className={cn('flex shrink-0 items-center gap-2', FULLSCREEN_CORNER_CLEAR)}>
        <BookOpen aria-hidden className="h-4 w-4 text-muted-foreground" />
        <span aria-hidden className="text-label font-semibold">Guide</span>
        <ReaderHistoryButtons history={view.history} fullScreen={{ shown: view.sectionId }} onStep={onStep} />
        <div className="ml-auto flex items-center gap-1">
          <Tip tip="Open Wiki">
            <button
              type="button"
              aria-label="Open Wiki"
              onClick={onOpenWiki}
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <ExternalLink aria-hidden className="h-4 w-4" />
            </button>
          </Tip>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border">
        {!guide ? <GuideUnavailable failed={failed} onRetry={onRetry} /> : sheet ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {open && view.reading ? (
              <>
                <BackRow label="Contents" onBack={() => onViewChange({ reading: false })} />
                <Reader guide={guide} sectionId={open.id} onOpen={openSection} />
              </>
            ) : <GuideRail guide={guide} view={view} onViewChange={onViewChange} semantic={semantic} className="flex min-h-0 flex-1 flex-col" />}
          </div>
        ) : (
          <>
            <GuideRail guide={guide} view={view} onViewChange={onViewChange} semantic={semantic} className="flex min-h-0 w-72 shrink-0 flex-col border-r" />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {open ? <Reader guide={guide} sectionId={open.id} onOpen={openSection} /> : <Hint className="p-3">Select a section to read</Hint>}
            </div>
          </>
        )}
      </div>
    </FullscreenShell>
  );
}
