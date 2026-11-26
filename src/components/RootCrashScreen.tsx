import { useState } from 'react';
import { Meta } from '@/components/ui/typography';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { copyText } from '@/lib/clipboard';
import { downloadBlob } from '@/lib/downloadBlob';
import { crashReportText } from '@/lib/crashReport';
import { readUnsavedWorld, unsavedWorldExportBlock } from '@/lib/unsavedWorld';
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
  const [uncopied, setUncopied] = useState('');
  // Read once: the reference outlives every provider, so the button does not come and go with renders.
  const [held] = useState(() => {
    const hold = unsavedWorldExportBlock();
    // A block with no reason means the world's marker was never read: nothing to export, nothing to explain.
    return hold && !hold.reason ? { world: null, block: null } : { world: readUnsavedWorld(), block: hold?.reason ?? null };
  });
  const { world, block } = held;

  const copyDetails = async () => {
    const report = crashReportText(error, componentStack);
    const copied = await copyText(report);
    if (!mounted.current) return;
    setStatus(copied ? 'Copied' : "Couldn't copy the text. Select the text below and copy it.");
    setUncopied(copied ? '' : report);
  };

  const exportWorld = async () => {
    if (!world || block) return;
    try {
      downloadBlob(await serializeWorldFile(world), `${world.worldOverview?.name || 'rpg_world'}.json`);
    } catch (exportError) {
      console.error('Failed to export the world after a crash:', exportError);
      if (mounted.current) setStatus("Couldn't export the world");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="relative flex w-full max-w-md flex-col items-center gap-4 rounded-lg border bg-card p-6 text-center text-card-foreground">
        <TriangleAlert className="h-10 w-10 text-warning" aria-hidden />
        <h1 className="text-title font-semibold">Formamorph Stopped Working</h1>
        <p className="text-muted-foreground">
          {!world
            ? 'Reload the app to continue.'
            : block
              ? `${block}, so your unsaved edits will be lost. Reload the app to continue.`
              : 'Export your world to keep your unsaved edits, then reload the app.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => void copyDetails()}>Copy Error Details</Button>
          {world && <Button variant="outline" disabled={!!block} onClick={() => void exportWorld()}>Export World</Button>}
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
        <Meta as="p" role="status" className="min-h-5">{status}</Meta>
        {/* Hangs below the card, so the buttons stay where they were. */}
        {uncopied && (
          <Textarea
            readOnly autoFocus value={uncopied} aria-label="Error details" size="sm" rows={8}
            onFocus={(e) => e.currentTarget.select()}
            className="absolute inset-x-0 top-full mt-2 resize-none font-mono"
          />
        )}
      </div>
    </main>
  );
}
