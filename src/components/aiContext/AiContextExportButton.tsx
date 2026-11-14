import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { ActionIcon } from '@/lib/actionIcons';
import { exportAiContext } from '@/lib/aiContext/exportAiContext';
import { cn } from '@/lib/utils';

/** The Export control of an AI Context viewer. Shared by the game view and Formaquestion. */
export function AiContextExportButton({ data, name, tip, disabled, blockedReason }: {
  data: unknown;
  /** What the export is of, for the file name. */
  name: string;
  tip: string;
  disabled?: boolean;
  /** Why the export is blocked; the button then shows disabled with it as its tooltip. */
  blockedReason?: string | null;
}) {
  return (
    <Tip tip={blockedReason ?? tip} labelsChild={false}>
      <Button
        variant="outline" size="sm" className={cn('h-8 flex-shrink-0 gap-1.5', blockedReason && 'cursor-not-allowed opacity-50')}
        aria-disabled={blockedReason ? true : undefined} aria-description={blockedReason ?? undefined}
        onClick={() => { if (!blockedReason) exportAiContext(data, name); }} disabled={disabled}
      >
        <ActionIcon.export className="h-4 w-4" />
        Export
      </Button>
    </Tip>
  );
}
