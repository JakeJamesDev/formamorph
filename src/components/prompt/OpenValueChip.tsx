import { useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  $getNodeByKey, $getSelection, $getSelectionSlotFrame, $getSlot, mountSlotContainer, type NodeKey,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChipVocabularyContext } from '@/lib/chipVocabulary';
import { tintMarkStyle } from '@/lib/previewTint';
import { OpenValuesContext, VALUE_SLOT } from './openValueContext';

// Lexical parks the slot container, its value box and the box's paragraph as blocks; a value reads inline.
const SLOT_TARGET_CLASS = '[&>*]:inline [&>*>*]:inline [&>*>*>*]:inline';

/**
 * A chip open on the Values tab: a header naming the placeholder and the open value, with a chevron each way
 * when there is another value to open, then the value itself.
 * The value lives in the node's named slot, which Lexical renders apart and this chip mounts in place.
 */
export function OpenValueChip({ nodeKey, token }: { nodeKey: NodeKey; token: string }) {
  const [editor] = useLexicalComposerContext();
  const vocab = useContext(ChipVocabularyContext);
  const open = useContext(OpenValuesContext)[token];
  const target = useRef<HTMLSpanElement>(null);
  const step = open?.step;

  // A refill reparks the container, so it mounts again after every update. Mounting in place is a no-op.
  useLayoutEffect(() => {
    const holdsCaret = () => editor.getEditorState().read(() => {
      const frame = $getSelectionSlotFrame($getSelection());
      const chip = $getNodeByKey(nodeKey);
      return !!frame && !!chip && !!$getSlot(chip, VALUE_SLOT)?.is(frame);
    });
    const mount = () => {
      if (!target.current) return;
      mountSlotContainer(editor, nodeKey, VALUE_SLOT, target.current);
      // A moved island loses focus; it takes it back itself, since focusing the editor root misses it.
      const island = target.current.querySelector<HTMLElement>('[data-lexical-slot]');
      if (island && document.activeElement === document.body && holdsCaret()) island.focus();
    };
    mount();
    return editor.registerUpdateListener(mount);
  }, [editor, nodeKey]);

  return (
    <span
      data-open-value
      className="rounded px-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
      style={tintMarkStyle(vocab.color(token))}
    >
      {/* mousedown is swallowed so a chevron click never moves the editor's caret. */}
      <span
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        className="mr-1 inline-flex select-none items-center gap-0.5 whitespace-nowrap text-meta font-medium text-muted-foreground"
      >
        {step && <StepButton label="Previous Value" onClick={() => step(-1)}><ChevronLeft className="h-3 w-3" /></StepButton>}
        {vocab.label(token)}
        {open?.label && <span className="font-normal"> · {open.label}</span>}
        {step && <StepButton label="Next Value" onClick={() => step(1)}><ChevronRight className="h-3 w-3" /></StepButton>}
      </span>
      <span ref={target} data-open-value-text className={SLOT_TARGET_CLASS} />
    </span>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="rounded hover:bg-accent hover:text-foreground">
      {children}
    </button>
  );
}
