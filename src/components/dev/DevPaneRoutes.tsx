/** DEV only: mounts each `DEV_PANE_MODALS` pane on canned props; closing one clears the route. */
import { useEffect, useRef, type ReactNode } from 'react';
import { ChangelogEntryDialog } from '@/components/community/ChangelogEntryDialog';
import { PendingUpdateSection } from '@/components/community/PendingUpdateSection';
import PlaceholderSectionList from '@/components/editor/PlaceholderSectionList';
import { FontTuneDialog } from '@/components/FontTuneDialog';
import { GenerateImageButton } from '@/components/GenerateImageButton';
import { EventFormDialog } from '@/components/menu/EventFormDialog';
import { FeedbackDialog } from '@/components/menu/FeedbackDialog';
import { toastFeedbackNotify } from '@/lib/feedbackToast';
import { FeedbackEditDialog } from '@/components/menu/FeedbackEditDialog';
import { FeedbackThreadView } from '@/components/menu/FeedbackThreadView';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PodiumDialog } from '@/components/menu/PodiumDialog';
import { SentMessagesDialog } from '@/components/menu/SentMessagesDialog';
import { SuspendDialog } from '@/components/menu/SuspendDialog';
import { ImportPresetDialog } from '@/components/modals/PresetShareDialogs';
import { RootCrashScreen } from '@/components/RootCrashScreen';
import { RevealAnimationDialog } from '@/components/RevealAnimationDemo';
import { devContestSamples } from '@/lib/devEventSample';
import { DEV_LIVE_THUMBNAIL, devApprovedChangelog, devPendingUpdate } from '@/lib/dev/devReviewStub';
import { devChangelogDraft, devFeedbackThread, devPickerRows, devPresetShareJson } from '@/lib/devPaneSamples';
import { useDevRoute } from '@/lib/devRouter';
import { IMAGE_CAPS } from '@/lib/imageSlots';
import { APP_VERSION } from '@/lib/version';
import { FEEDBACK_TYPES } from '@/types';

const clearRouteOnClose = (open: boolean) => { if (!open) window.location.hash = '#dev'; };
const ignore = () => {};

/** Presses the trigger inside once, for a pane that opens only from its own button. */
function Pressed({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector('button')?.click(); }, []);
  return <div ref={ref} className="fixed left-4 top-4 z-40 w-64">{children}</div>;
}

/** Pastes `text` into the open dialog's text box once the dialog has mounted. */
function Pasted({ text, children }: { text: string; children: ReactNode }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      const box = document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea');
      if (!box) return;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(box, text);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }, 100);
    return () => clearTimeout(timer);
  }, [text]);
  return children;
}

export default function DevPaneRoutes() {
  const route = useDevRoute();
  switch (route?.modal) {
    case 'eventForm': return <EventFormDialog open onOpenChange={clearRouteOnClose} />;
    case 'podium': return <PodiumDialog open onOpenChange={clearRouteOnClose} contest={devContestSamples()[1]} />;
    case 'sentMessages': return <SentMessagesDialog open onOpenChange={clearRouteOnClose} username="Sample Player" />;
    case 'suspend': return <SuspendDialog open onOpenChange={clearRouteOnClose} username="Sample Player" alreadySuspended={false} onConfirm={ignore} />;
    case 'feedbackForm': {
      const type = FEEDBACK_TYPES.find((value) => value === route.tab) ?? 'bug';
      const { title, body } = devFeedbackThread(type);
      return <FeedbackDialog open onOpenChange={clearRouteOnClose} initialType={type} initialTitle={title} initialBody={body} notify={toastFeedbackNotify} />;
    }
    case 'feedbackEdit': return <FeedbackEditDialog open onOpenChange={clearRouteOnClose} thread={devFeedbackThread()} mayEditProse mayRefile onSaved={ignore} notify={toastFeedbackNotify} threadSearchTypes={null} />;
    case 'feedbackThread': {
      const staff = route.tab === 'staff';
      return (
        <Dialog open onOpenChange={clearRouteOnClose}>
          <DialogContent surface="feedbackHub" aria-describedby={undefined} className="sm:max-w-[900px] h-[90dvh] flex flex-col overflow-hidden">
            <DialogTitle className="sr-only">Feedback</DialogTitle>
            <ScrollArea className="flex-1 min-h-0 min-w-0 px-1">
              <FeedbackThreadView threadId="dev-question-answered" onBack={() => clearRouteOnClose(false)} isAdmin={staff} showTriage={staff} notify={toastFeedbackNotify} />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      );
    }
    case 'changelogEntry': return <ChangelogEntryDialog open onOpenChange={clearRouteOnClose} entry={devChangelogDraft()} onSubmit={ignore} />;
    case 'fontTune': return <FontTuneDialog font="system" open onOpenChange={clearRouteOnClose} />;
    case 'revealDemo': return <RevealAnimationDialog open onOpenChange={clearRouteOnClose} kind="narration" />;
    case 'presetImport': return (
      <Pasted text={devPresetShareJson(APP_VERSION)}>
        <ImportPresetDialog open onOpenChange={clearRouteOnClose} currentAppVersion={APP_VERSION} existingUserNames={[]} userTools={[]} onImport={ignore} />
      </Pasted>
    );
    case 'generateImage': return (
      <Pressed>
        <GenerateImageButton subject={{ description: 'A lantern keeper', kind: 'character' }} cap={IMAGE_CAPS.entity} onChange={ignore} />
      </Pressed>
    );
    case 'placeholderPicker': return (
      <Pressed>
        <PlaceholderSectionList rows={devPickerRows()} selectedId="" onSelect={ignore} placeholders={[]} />
      </Pressed>
    );
    case 'rootCrash': return (
      <div className="fixed inset-0 z-50 bg-background">
        <RootCrashScreen error={new Error('Sample crash')} componentStack={'\n    at SampleComponent\n    at App'} />
      </div>
    );
    case 'pendingUpdate': return (
      <div className="fixed left-4 top-4 z-40 w-80 rounded-md border border-border bg-background p-4">
        <PendingUpdateSection
          listingId="dev-review-update"
          name="Lanterns Over the Marsh"
          update={devPendingUpdate()}
          liveThumbnail={DEV_LIVE_THUMBNAIL}
          approvedChangelog={devApprovedChangelog()}
          onDiscarded={() => clearRouteOnClose(false)}
          initialCompareOpen={route.tab === 'compare'}
        />
      </div>
    );
    default: return null;
  }
}
