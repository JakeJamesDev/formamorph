import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { ActionIcon } from '@/lib/actionIcons';
import { exportAiContext } from '@/lib/aiContext/exportAiContext';

/** The Export control of an AI Context viewer. Shared by the game view and Formaquestion. */
export function AiContextExportButton({ data, name, tip, disabled }: {
  data: unknown;
  /** What the export is of, for the file name. */
  name: string;
  tip: string;
  disabled?: boolean;
}) {
  return (
    <Tip tip={tip} labelsChild={false}>
      <Button variant="outline" size="sm" className="h-8 flex-shrink-0 gap-1.5" onClick={() => exportAiContext(data, name)} disabled={disabled}>
        <ActionIcon.export className="h-4 w-4" />
        Export
      </Button>
    </Tip>
  );
}
