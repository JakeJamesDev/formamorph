import { Redo2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { useWorldHistory } from '@/contexts/worldRecorder';

const FACE = 'h-8 rounded-none border-y border-l px-2.5 first:rounded-l-md last:rounded-r-md last:border-r';

/** The app bar's split control for the open world's history: one face per move, joined into one pill. */
export function HistoryPill({ disabled = false }: { disabled?: boolean }) {
  const { canUndo, canRedo, undo, redo } = useWorldHistory();
  return (
    <div className="flex items-center" role="group" aria-label="History">
      <Tip tip="Undo (Ctrl+Z)" labelsChild={false}>
        <Button variant="ghost" size="sm" className={FACE} onClick={undo} disabled={disabled || !canUndo} aria-label="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
      </Tip>
      <Tip tip="Redo (Ctrl+Y)" labelsChild={false}>
        <Button variant="ghost" size="sm" className={FACE} onClick={redo} disabled={disabled || !canRedo} aria-label="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
      </Tip>
    </div>
  );
}
