import type { ReactNode } from 'react';
import { AlertCircle, Check, Loader2, Save } from 'lucide-react';
import { SplitButton, type SplitButtonAction } from '@/components/ui/split-button';
import { cn } from '@/lib/utils';
import type { SaveStatus } from './useSaveStatus';

const ANNOUNCEMENT: Record<SaveStatus, string> = {
  clean: '', pending: '', saving: 'Saving', saved: 'Saved', failed: 'Save failed',
};
export const SAVE_FAILED_TIP = 'Save failed. Select to try again.';

type Face = 'save' | 'saving' | 'saved' | 'failed';
const FACES: Face[] = ['save', 'saving', 'saved', 'failed'];
const faceOf = (status: SaveStatus): Face => (status === 'clean' || status === 'pending' ? 'save' : status);
const LABEL: Record<Face, string> = { save: 'Save', saving: 'Saving…', saved: 'Saved', failed: 'Failed' };

// The spinner turns only while it shows; a hidden one would spin under opacity 0 forever.
const icon = (face: Face, shown: boolean): ReactNode => ({
  save: <Save className="h-4 w-4" />,
  saving: <Loader2 className={cn('h-4 w-4', shown && 'animate-spin')} />,
  saved: <Check className="h-4 w-4" />,
  failed: <AlertCircle className="h-4 w-4" />,
})[face];

// Saved uses the normal text color for contrast; the long ease into the disabled look is the fade.
const TONE: Partial<Record<SaveStatus, string>> = {
  saved: 'bg-success/20 text-foreground hover:bg-success/20',
  failed: 'bg-destructive-fill text-destructive-foreground hover:bg-destructive-fill/90 focus-visible:ring-destructive-foreground',
};
const motion = (status: SaveStatus) => cn(
  'transition-[opacity,color,background-color,border-color]',
  status === 'clean' && 'duration-700 ease-out',
);

/** Every face sits in one grid cell, so the button is as wide as the widest and never shifts. */
function FaceStack({ status, iconOnly }: { status: SaveStatus; iconOnly: boolean }) {
  const current = faceOf(status);
  return (
    <span className="grid">
      {FACES.map((face) => (
        <span
          key={face}
          aria-hidden={face !== current}
          data-save-face={face}
          className={cn(
            '[grid-area:1/1] flex items-center justify-center', motion(status),
            face === current ? 'opacity-100' : 'opacity-0',
          )}
        >
          {icon(face, face === current)}
          {!iconOnly && <span className="ml-2">{LABEL[face]}</span>}
        </span>
      ))}
    </span>
  );
}

/**
 * The World Editor's Save split button. Its face shows the save state: Save, Saving…, Saved and then the muted
 * Save, or Failed until a save succeeds. A polite live region announces each state.
 */
export function SaveSplitButton({ status, onSave, menu, iconOnly = false }: {
  status: SaveStatus;
  onSave: () => void;
  menu: SplitButtonAction[];
  /** Mobile's footer face: the icon morphs and the tip names it. */
  iconOnly?: boolean;
}) {
  const failed = status === 'failed';
  return (
    <>
      <SplitButton
        variant="default"
        side={iconOnly ? 'top' : 'bottom'}
        align="end"
        size={iconOnly ? 'icon' : 'sm'}
        tourAnchor="save"
        menu={menu}
        menuLabel="Save options"
        label={iconOnly ? undefined : LABEL[faceOf(status)]}
        faceTip={failed ? SAVE_FAILED_TIP : iconOnly ? 'Save' : 'Save (Ctrl+S)'}
        faceDisabled={status === 'clean'}
        faceAriaDisabled={status === 'saving' || status === 'saved'}
        faceClassName={cn(motion(status), TONE[status])}
        onClick={onSave}
      >
        <FaceStack status={status} iconOnly={iconOnly} />
      </SplitButton>
      <span className="sr-only" aria-live="polite">{ANNOUNCEMENT[status]}</span>
    </>
  );
}
