import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { canStep, type FullScreenView, type ReaderHistory } from '@/lib/formaquestion/readerHistory';

/** The Back and Forward buttons that move through the reader's history. A button is off where its direction has no entry. */
export function ReaderHistoryButtons({ history, fullScreen, onStep }: {
  history: ReaderHistory;
  /** Set in the full screen, which steps over what it cannot show. */
  fullScreen?: FullScreenView;
  onStep: (delta: -1 | 1) => void;
}) {
  return (
    <div role="group" aria-label="Reader History" className="flex items-center">
      <StepButton label="Back" shortcut="Alt+ArrowLeft" icon={ChevronLeft} disabled={!canStep(history, -1, fullScreen)} onClick={() => onStep(-1)} />
      <StepButton label="Forward" shortcut="Alt+ArrowRight" icon={ChevronRight} disabled={!canStep(history, 1, fullScreen)} onClick={() => onStep(1)} />
    </div>
  );
}

function StepButton({ label, shortcut, icon: Icon, disabled, onClick }: {
  label: string;
  /** The shortcut as `aria-keyshortcuts` names it. The tip drops the "Arrow". */
  shortcut: string;
  icon: LucideIcon;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Tip tip={`${label} (${shortcut.replace('Arrow', '')})`}>
      <Button variant="ghost" size="icon" aria-label={label} aria-keyshortcuts={shortcut} disabled={disabled} onClick={onClick} className="h-8 w-8">
        <Icon aria-hidden className="h-4 w-4" />
      </Button>
    </Tip>
  );
}
