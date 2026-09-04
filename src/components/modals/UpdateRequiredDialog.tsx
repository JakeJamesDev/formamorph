import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { APP_VERSION } from '@/lib/version';
import { watchClientVersion, type ClientUpdateRequired } from '@/lib/clientIdentity';
import { updateBridge } from '@/lib/updates/updateBridge';
import { useDevRoute } from '@/lib/devRouter';
import { useSettings } from '@/contexts/SettingsContext';
import { checkForUpdate } from '@/services/UpdateService';
import AuthService from '@/services/AuthService';

/** Where the offer has got to. The platform owns everything after Update. */
type Phase =
  | { kind: 'offer' }
  | { kind: 'starting' }
  | { kind: 'started' }
  | { kind: 'failed'; error: string };

/** The sentence naming what was refused, in the two shapes a reply can leave it. */
function requirement({ feature, minVersion }: ClientUpdateRequired): string {
  const what = feature || 'This part of Formamorph';
  const needs = minVersion ? `Formamorph ${minVersion} or newer` : 'a newer version of Formamorph';
  return `${what} needs ${needs}. You are running ${APP_VERSION}.`;
}

interface UpdateRequiredDialogProps {
  required: ClientUpdateRequired;
  phase: Phase;
  onUpdate: () => void;
  onDismiss: () => void;
}

/**
 * What a player on a build too old for one feature is told.
 *
 * Dismissible on purpose: the refusal is one route deep, and the rest of the app — saves, local play,
 * every feature the server did not gate — is untouched by it. A dialog that could not be closed would
 * make one gated request look like a broken game.
 */
export function UpdateRequiredDialog({ required, phase, onUpdate, onDismiss }: UpdateRequiredDialogProps) {
  const started = phase.kind === 'started';

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onDismiss(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Update Formamorph</DialogTitle>
        </DialogHeader>

        <div className="py-2 text-label space-y-2 min-w-0">
          <p>{requirement(required)}</p>
          <p className="text-muted-foreground">Everything else keeps working.</p>
          {started && (
            <p className="text-muted-foreground">The update has started. You can keep playing while it finishes.</p>
          )}
          {phase.kind === 'failed' && <p className="text-destructive">{phase.error}</p>}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={onDismiss}>{started ? 'Close' : 'Not Now'}</Button>
          {!started && (
            <Button onClick={onUpdate} disabled={phase.kind === 'starting'}>
              {phase.kind === 'starting' ? 'Starting…' : 'Update'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The one Update Dialog the app raises, wherever the refusal came from.
 *
 * Mounted ahead of the views for the same reason the privacy prompt sits beside them: a route can refuse
 * a request made from any screen, and the header this installs has to be on `fetch` before the first of
 * those screens asks for anything.
 *
 * A screen that retries a refused request refuses again, so the same feature raises the dialog once and
 * then leaves it alone — including an update already started from inside it. A different feature replaces
 * what is on screen, because it is the thing the player just tried.
 *
 * Update hands off rather than driving: the desktop shell owns the download it starts, and the main
 * menu's version line owns applying it. Here that is one press and a sentence saying it is under way.
 */
export function UpdateRequiredGate() {
  const [required, setRequired] = useState<ClientUpdateRequired | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'offer' });
  const devRoute = useDevRoute();
  const { updateChannel } = useSettings();

  // What the dialog is showing, read from the refusal callback — where a state value would be the one
  // captured when the watch was installed.
  const showing = useRef<string | null>(null);

  const raise = useCallback((next: ClientUpdateRequired) => {
    if (showing.current === next.feature) return;
    showing.current = next.feature;
    setPhase({ kind: 'offer' });
    setRequired(next);
  }, []);

  useEffect(() => watchClientVersion(AuthService.API_URL, raise), [raise]);

  // DEV: `#dev?modal=updateRequired` raises the dialog on a canned refusal, because the real one needs a
  // server route whose minimum is above this build.
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.modal === 'updateRequired') {
      raise({ feature: 'Contests', minVersion: '99.0.0' });
    }
  }, [devRoute?.modal, raise]);

  const dismiss = useCallback(() => {
    showing.current = null;
    setPhase({ kind: 'offer' });
    setRequired(null);
  }, []);

  const update = useCallback(async () => {
    const bridge = updateBridge();
    // No bridge is the browser, where the new build is whatever the server serves next.
    if (!bridge) {
      window.location.reload();
      return;
    }

    setPhase({ kind: 'starting' });

    // The release comes from the channel-aware check rather than the bridge's own default, which is the
    // newest release of either channel — a stable player must not be handed a prerelease.
    const found = await checkForUpdate(updateChannel);
    const version = found.result?.latestVersion;
    if (!found.success || !version) {
      setPhase({ kind: 'failed', error: found.error || 'No newer version is available yet.' });
      return;
    }

    try {
      await bridge.download({ version, channel: updateChannel });
      setPhase({ kind: 'started' });
    } catch (error) {
      setPhase({ kind: 'failed', error: (error as Error)?.message || 'The download failed' });
    }
  }, [updateChannel]);

  if (!required) return null;

  return (
    <UpdateRequiredDialog
      required={required}
      phase={phase}
      onUpdate={() => { void update(); }}
      onDismiss={dismiss}
    />
  );
}
