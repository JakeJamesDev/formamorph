import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { badgeVariants } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Meta } from '@/components/ui/typography';
import { Tooltip, TooltipPopup, TooltipPortal, TooltipPositioner, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { openRoadScene } from '@/components/road/roadSceneStore';
import { useDemoAIOfferAvailable } from '@/components/road/useDemoAIOffer';
import { useSettings } from '@/contexts/SettingsContext';
import { deviceCanRunDesktopApp } from '@/lib/desktopAppOffer';
import { openDocsFromClick } from '@/lib/formaquestion/docsOpener';
import { wikiPageUrl } from '@/lib/helpTopics';
import { markDemoAISeen } from './demoAISeen';

const SITE_URL = 'https://formamorph.ai';

export interface DemoAINoticeHandle {
  /** Opens the dialog outside the entry path, whatever the seen-key says. */
  open(): void;
}

/** The Demo AI dialog, which the badge opens. */
export const DemoAINotice = forwardRef<DemoAINoticeHandle>(function DemoAINotice(_, ref) {
  const { requestSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const connectRef = useRef<HTMLButtonElement>(null);

  const openDialog = useCallback(() => {
    markDemoAISeen();
    setOpen(true);
  }, []);
  useImperativeHandle(ref, () => ({ open: openDialog }), [openDialog]);

  const close = () => setOpen(false);

  const desktopOffer = deviceCanRunDesktopApp();
  const offerAvailable = useDemoAIOfferAvailable();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      {/* Capped to the keyboard-aware viewport: the body scrolls and the footer stays on screen. */}
      <DialogContent
        surface="demoAI"
        className="flex max-h-[calc(var(--app-h,100dvh)-1rem)] w-[min(96vw,520px)] max-w-none flex-col"
        onOpenAutoFocus={(event) => { event.preventDefault(); connectRef.current?.focus(); }}
      >
        {/* Left-aligned at every width: the description is the first of five paragraphs. */}
        <DialogHeader className="shrink-0 text-left">
          <DialogTitle>You&apos;re Playing on the Demo AI</DialogTitle>
        </DialogHeader>
        <ScrollArea data-testid="demo-ai-body" className="-mr-3 min-h-0 flex-1 pr-3">
          <div className="space-y-3 text-body">
            <DialogDescription className="text-body text-foreground">
              You&apos;re playing on Formamorph&apos;s free built-in AI. It&apos;s a small model, and it&apos;s here so you
              can try the app with no setup.
            </DialogDescription>
            <p>
              The AI writes everything you read. A stronger model writes sharper narration, keeps each entity
              consistent, and remembers more of your story. Nothing else in Formamorph changes your game as much.
            </p>
            <p>If a world seems dull, try it on a stronger model before you judge it.</p>
            <p>
              For the full experience, connect your own AI in <strong>Settings</strong>. Any OpenAI-compatible
              endpoint works, local or hosted.{' '}
              <a
                href={wikiPageUrl('Connect-Your-Own-AI')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  if (openDocsFromClick(event, { page: 'Connect-Your-Own-AI' })) close();
                }}
                className="text-primary underline underline-offset-4"
              >
                How to set up your own AI
              </a>
            </p>
            {desktopOffer && (
              <p>
                Want to run a model on your own PC? The desktop app has the AI engine built in, so there&apos;s
                nothing extra to install. The model you can run depends on your hardware.
              </p>
            )}
            {offerAvailable && (
              <div className="flex items-center justify-between gap-3">
                <p>Formamorph AI is a stronger AI with no setup. Your support on Patreon includes it and helps fund new updates.</p>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => { close(); openRoadScene(); }}>
                  See Levels
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
        {/* Negative first: the shared footer puts the last action on the right, and on top below `sm`. */}
        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={close}>Keep Playing</Button>
          {desktopOffer && (
            <Button variant="outline" asChild>
              <a href={SITE_URL} target="_blank" rel="noopener noreferrer">Get the Desktop App</a>
            </Button>
          )}
          <Button ref={connectRef} onClick={() => { close(); requestSettings('endpoints'); }}>Connect an AI</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

/** The short line a first game entry on the Demo AI shows in the narration area. */
export function DemoAIEntryLine() {
  // The right padding keeps the text clear of the badge and options in the frame's corner.
  return (
    <Meta as="p" role="status" data-testid="demo-ai-entry-line" className="mb-2 shrink-0 pr-28">
      You&apos;re on the Demo AI, a small free model. Select its badge to learn more.
    </Meta>
  );
}

/** The Demo AI status badge. It shows while narration resolves to the Demo AI, and a click opens the dialog. */
export function DemoAIBadge({ onOpen }: { onOpen: () => void }) {
  const { narrationIsDemoAI } = useSettings();
  if (!narrationIsDemoAI) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" onClick={onOpen} className={cn(badgeVariants({ variant: 'secondary' }), 'shrink-0 self-center')}>
            Demo AI
          </button>
        }
      />
      <TooltipPortal>
        <TooltipPositioner side="bottom">
          <TooltipPopup>
            A small free model for trying Formamorph. For much better narration, connect a stronger AI in{' '}
            <strong>Settings</strong>.
            {deviceCanRunDesktopApp() && ' The desktop app can run one on your PC if your hardware allows.'}
          </TooltipPopup>
        </TooltipPositioner>
      </TooltipPortal>
    </Tooltip>
  );
}
