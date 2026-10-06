import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/clipboard';
import { downloadBlob } from '@/lib/downloadBlob';
import { crashReportText } from '@/lib/crashReport';
import { readUnsavedWorld } from '@/lib/unsavedWorld';
import { useMountedRef } from '@/lib/useMountedRef';
import { serializeWorldFile } from '@/lib/worldFile';

interface RootCrashScreenProps {
  error: unknown;
  componentStack: string;
}

/**
 * The screen a crash of the whole app shows. It stands outside every provider, so it reaches nothing
 * but plain modules: no toasts, no settings, no dialogs.
 */
export function RootCrashScreen({ error, componentStack }: RootCrashScreenProps) {
  const mounted = useMountedRef();
  const [status, setStatus] = useState('');
  // Read once: the reference outlives every provider, so the button does not come and go with renders.
  const [world] = useState(readUnsavedWorld);

  const copyDetails = async () => {
    const copied = await copyText(crashReportText(error, componentStack));
    if (mounted.current) setStatus(copied ? 'Copied' : "Couldn't copy the text");
  };

  const exportWorld = async () => {
    if (!world) return;
    try {
      downloadBlob(await serializeWorldFile(world), `${world.worldOverview?.name || 'rpg_world'}.json`);
    } catch (exportError) {
      console.error('Failed to export the world after a crash:', exportError);
      if (mounted.current) setStatus("Couldn't export the world");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border bg-card p-6 text-center text-card-foreground">
        <TriangleAlert className="h-10 w-10 text-warning" aria-hidden />
        <h1 className="text-title font-semibold">Formamorph Stopped Working</h1>
        <p className="text-muted-foreground">
          {world
            ? 'Export your world to keep your unsaved edits, then reload the app.'
            : 'Reload the app to continue.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => void copyDetails()}>Copy Error Details</Button>
          {world && <Button variant="outline" onClick={() => void exportWorld()}>Export World</Button>}
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
        <p role="status" className="min-h-5 text-helper text-muted-foreground">{status}</p>
      </div>
    </main>
  );
}
