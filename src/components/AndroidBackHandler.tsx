import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { DoorOpen } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useDevRoute } from '@/lib/devRouter';
import { CLOSE_APP_PROMPT } from '@/lib/leavePrompts';

/** Text for a prompt the back button raises, plus what saying yes does. */
interface BackPrompt {
  title: string;
  description: string;
  confirm: () => void;
}

/**
 * The Android hardware back button, and the prompts that stand in front of leaving. Renders nothing
 * until a back press asks to leave something that costs the player to leave.
 */
export function AndroidBackHandler({
  viewHistory,
  onGoBack,
  confirmGoBack,
}: {
  /** Views entered so far, oldest first. The last one is on screen. */
  viewHistory: readonly string[];
  /** Leave the current view for the one before it. */
  onGoBack: () => void;
  /** Ask this before leaving the current view. Omit where leaving it costs nothing. */
  confirmGoBack?: { title: string; description: string };
}) {
  const [prompt, setPrompt] = useState<BackPrompt | null>(null);

  useHardwareBack({
    viewHistory,
    // A sub-screen with its own guard answers back before this does, so only a whole view reaches here.
    onGoBack: () => (confirmGoBack ? setPrompt({ ...confirmGoBack, confirm: onGoBack }) : onGoBack()),
    onConfirmExit: () => setPrompt({ ...CLOSE_APP_PROMPT, confirm: () => void App.exitApp() }),
  });

  // DEV: `#dev?modal=exitApp` raises the prompt, which otherwise only a hardware back press can reach.
  const devRoute = useDevRoute();
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.modal === 'exitApp') {
      setPrompt({ ...CLOSE_APP_PROMPT, confirm: () => void App.exitApp() });
    }
  }, [devRoute?.modal]);

  return (
    <ConfirmDialog
      open={prompt !== null}
      onOpenChange={(open) => { if (!open) setPrompt(null); }}
      title={prompt?.title}
      icon={<DoorOpen className="h-4 w-4" />}
      description={prompt?.description}
      onConfirm={() => prompt?.confirm()}
    />
  );
}
