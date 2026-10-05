/** DEV only: mounts each `DEV_PANE_MODALS` pane on canned props; closing one clears the route. */
import { useEffect, useRef, type ReactNode } from 'react';
import { ChangelogEntryDialog } from '@/components/community/ChangelogEntryDialog';
import PlaceholderSectionList from '@/components/editor/PlaceholderSectionList';
import { FontTuneDialog } from '@/components/FontTuneDialog';
import { GenerateImageButton } from '@/components/GenerateImageButton';
import { EventFormDialog } from '@/components/menu/EventFormDialog';
import { FeedbackDialog } from '@/components/menu/FeedbackDialog';
import { FeedbackEditDialog } from '@/components/menu/FeedbackEditDialog';
import { PodiumDialog } from '@/components/menu/PodiumDialog';
import { SentMessagesDialog } from '@/components/menu/SentMessagesDialog';
import { ImportPresetDialog } from '@/components/modals/PresetShareDialogs';
import { RevealAnimationDialog } from '@/components/RevealAnimationDemo';
import { devContestSamples } from '@/lib/devEventSample';
import { devChangelogDraft, devFeedbackThread, devPickerRows, devPresetShareJson } from '@/lib/devPaneSamples';
import { useDevRoute } from '@/lib/devRouter';
import { IMAGE_CAPS } from '@/lib/imageSlots';
import { APP_VERSION } from '@/lib/version';

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
  switch (useDevRoute()?.modal) {
    case 'eventForm': return <EventFormDialog open onOpenChange={clearRouteOnClose} />;
    case 'podium': return <PodiumDialog open onOpenChange={clearRouteOnClose} contest={devContestSamples()[1]} />;
    case 'sentMessages': return <SentMessagesDialog open onOpenChange={clearRouteOnClose} username="Sample Player" />;
    case 'feedbackForm': {
      const { title, body } = devFeedbackThread();
      return <FeedbackDialog open onOpenChange={clearRouteOnClose} initialTitle={title} initialBody={body} />;
    }
    case 'feedbackEdit': return <FeedbackEditDialog open onOpenChange={clearRouteOnClose} thread={devFeedbackThread()} mayEditProse mayRefile onSaved={ignore} />;
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
    default: return null;
  }
}
