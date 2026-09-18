import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { badgeVariants } from '@/components/ui/badge';
import { Tooltip, TooltipPopup, TooltipPortal, TooltipPositioner, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/SettingsContext';
import { deviceCanRunDesktopApp } from '@/lib/desktopAppOffer';
import { wikiPageUrl } from '@/lib/helpTopics';
import { isDemoAISeen, markDemoAISeen } from './demoAISeen';

const SITE_URL = 'https://formamorph.ai';

export interface DemoAINoticeHandle {
  /** Opens the dialog outside the entry path, whatever the seen-key says. */
  open(): void;
}

interface DemoAINoticeProps {
  /** The entry order released the Demo AI dialog for this entry. */
  entry: boolean;
  /** The entry turn is over: the dialog closed, or it had nothing to show. */
  onEntryDone?: () => void;
}

/** The Demo AI dialog and its seen-key. */
export const DemoAINotice = forwardRef<DemoAINoticeHandle, DemoAINoticeProps>(function DemoAINotice(
  { entry, onEntryDone },
  ref,
) {
  const { narrationIsDemoAI, requestSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const entryOpenRef = useRef(false);
  const entryHandledRef = useRef(false);

  const openDialog = useCallback(() => {
    markDemoAISeen();
    setOpen(true);
  }, []);
  useImperativeHandle(ref, () => ({ open: openDialog }), [openDialog]);

  useEffect(() => {
    if (!entry || entryHandledRef.current) return;
    entryHandledRef.current = true;
    if (narrationIsDemoAI && !isDemoAISeen()) {
      entryOpenRef.current = true;
      openDialog();
    } else {
      onEntryDone?.();
    }
  }, [entry, narrationIsDemoAI, openDialog, onEntryDone]);

  const close = () => {
    setOpen(false);
    if (entryOpenRef.current) {
      entryOpenRef.current = false;
      onEntryDone?.();
    }
  };

  const desktopOffer = deviceCanRunDesktopApp();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="w-[min(96vw,520px)] max-w-none">
        {/* Left-aligned at every width: the description is the first of five paragraphs. */}
        <DialogHeader className="text-left">
          <DialogTitle>You&apos;re Playing on the Demo AI</DialogTitle>
          <DialogDescription className="text-body text-foreground">
            Formamorph is using its free built-in AI. It&apos;s a small model, and it&apos;s here so you can try the
            app with zero setup.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-body">
          <p>
            The AI writes everything you read. A stronger model gives you sharper narration, a better memory of
            your story, and characters who stay in character. Nothing else in Formamorph changes the experience
            as much.
          </p>
          <p>If a world feels flat, try it on a stronger model before you judge it.</p>
          <p>
            For the full experience, connect your own AI in <strong>Settings</strong>. Any OpenAI-compatible
            endpoint works, local or hosted.{' '}
            <a
              href={wikiPageUrl('Connect-Your-Own-AI')}
              target="_blank"
              rel="noopener noreferrer"
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
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={() => { close(); requestSettings('endpoints'); }}>Connect an AI</Button>
          {desktopOffer && (
            <Button variant="outline" asChild>
              <a href={SITE_URL} target="_blank" rel="noopener noreferrer">Get the Desktop App</a>
            </Button>
          )}
          <Button variant="ghost" onClick={close}>Keep Playing</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

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
