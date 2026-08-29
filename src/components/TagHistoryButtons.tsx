import { Undo2, Redo2 } from 'lucide-react';
import { TOOLBAR_BTN } from '@/components/prompt/toolbarStyles';
import { Tip } from '@/components/ui/tooltip';
import { type useTagHistory } from '@/lib/useTagHistory';

/** Undo/redo for a tag field, styled to match the buttons a prompt field draws for itself. */
const TagHistoryButtons = ({ history }: { history: ReturnType<typeof useTagHistory> }) => (
  <>
    <Tip tip="Undo">
      <button
        type="button" className={TOOLBAR_BTN}
        disabled={!history.canUndo} onClick={history.undo}
      >
        <Undo2 className="h-4 w-4" />
      </button>
    </Tip>
    <Tip tip="Redo">
      <button
        type="button" className={TOOLBAR_BTN}
        disabled={!history.canRedo} onClick={history.redo}
      >
        <Redo2 className="h-4 w-4" />
      </button>
    </Tip>
  </>
);

export default TagHistoryButtons;
