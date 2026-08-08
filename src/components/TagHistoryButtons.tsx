import { Undo2, Redo2 } from 'lucide-react';
import { TOOLBAR_BTN } from '@/components/prompt/toolbarStyles';
import { type useTagHistory } from '@/lib/useTagHistory';

/** Undo/redo for a tag field, styled to match the buttons a prompt field draws for itself. */
const TagHistoryButtons = ({ history }: { history: ReturnType<typeof useTagHistory> }) => (
  <>
    <button
      type="button" title="Undo" aria-label="Undo" className={TOOLBAR_BTN}
      disabled={!history.canUndo} onClick={history.undo}
    >
      <Undo2 className="h-4 w-4" />
    </button>
    <button
      type="button" title="Redo" aria-label="Redo" className={TOOLBAR_BTN}
      disabled={!history.canRedo} onClick={history.redo}
    >
      <Redo2 className="h-4 w-4" />
    </button>
  </>
);

export default TagHistoryButtons;
