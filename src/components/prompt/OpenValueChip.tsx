import { useCallback, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  $getNodeByKey, $getSelection, $getSelectionSlotFrame, $getSlot, $setSelection, mountSlotContainer, type NodeKey,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import { ChipVocabularyContext } from '@/lib/chipVocabulary';
import { cn } from '@/lib/utils';
import { $isVariableNode } from './VariableNode';
import {
  ActiveValueContext, EditValueContext, OpenValuesContext, VALUE_SLOT, activeValueKey, type OpenValuePager,
} from './openValueContext';
import { $caretChipKey, $editableCopyKey, $openValueReadOnly } from './openValueCopies';
import { $valueBox } from './openValueNodes';

// Lexical parks the slot container, its value box and the box's paragraph as blocks; a value reads inline.
const SLOT_TARGET_CLASS = '[&>*]:inline [&>*>*]:inline [&>*>*>*]:inline';

/**
 * A chip open on the Values tab: a header naming the placeholder, a pager through its values, and the value
 * itself inside a traced outline. The value lives in the node's named slot, which Lexical renders apart and
 * this chip mounts in place. `OpenValueLayoutPlugin` seats the header and draws the outline.
 * Only the active value — the one holding the caret, else the one whose header was pressed last — shows its
 * verbose label and carries a line.
 */
export function OpenValueChip({ nodeKey, token }: { nodeKey: NodeKey; token: string }) {
  const [editor] = useLexicalComposerContext();
  const vocab = useContext(ChipVocabularyContext);
  const values = useContext(OpenValuesContext);
  const { asked, settle } = useContext(EditValueContext);
  const { pressed, press } = useContext(ActiveValueContext);
  const open = values[token];
  const target = useRef<HTMLSpanElement>(null);
  // What takes input from this value away: the whole field, or this value alone.
  const [readOnly, setReadOnly] = useState<'field' | 'value' | null>(null);
  // From the editor's selection, since `:focus-within` fails while the document itself lacks focus.
  const [active, setActive] = useState(false);
  // The last "Edit Value" ask this value answered.
  const answered = useRef<NodeKey | null>(null);
  // Whether this value takes input, as the last mount read it — what the header's press handler goes by.
  const locked = useRef(false);

  /**
   * Puts the caret at the end of this value. The island is its own editing host, so it is focused by name
   * rather than through the selection Lexical is about to reconcile, which reaches it only while nothing
   * else holds the keyboard. Focus never scrolls: the author is already reading where they pressed.
   */
  const caretToEnd = useCallback(() => {
    target.current?.querySelector<HTMLElement>('[data-lexical-slot]')?.focus({ preventScroll: true });
    editor.update(() => {
      const chip = $getNodeByKey(nodeKey);
      if ($isVariableNode(chip)) $valueBox(chip)?.selectEnd();
    });
  }, [editor, nodeKey]);

  // A refill reparks the container, so it mounts again after every update. Mounting in place is a no-op.
  useLayoutEffect(() => {
    const holdsCaret = () => editor.getEditorState().read(() => {
      const frame = $getSelectionSlotFrame($getSelection());
      const chip = $getNodeByKey(nodeKey);
      return !!frame && !!chip && !!$getSlot(chip, VALUE_SLOT)?.is(frame);
    });
    /**
     * Focuses this value's island and puts the caret where the editor says it is. Focus alone lands the
     * browser's own caret at the value's start, which is neither where the author left it nor where a step
     * just put it, so the editor's selection is re-applied over it.
     */
    const takeKeyboard = (island: HTMLElement) => {
      island.focus({ preventScroll: true });
      // A host that refuses focus would be asked again by the update this schedules, forever.
      if (!island.contains(document.activeElement)) return;
      editor.update(() => {
        const selection = $getSelection();
        $setSelection(selection ? selection.clone() : null);
      });
    };
    const mount = () => {
      if (!target.current) return;
      mountSlotContainer(editor, nodeKey, VALUE_SLOT, target.current);
      // A moved island loses focus, and a step lands the caret in a value the pointer never entered. Either
      // way the island takes focus back itself, since focusing the editor root misses it. Only from nowhere
      // or from this value's own header: a caret the author is placing elsewhere in the editor must be left
      // to land, or a click in the field text beside this chip is pulled into the value.
      const island = target.current.querySelector<HTMLElement>('[data-lexical-slot]');
      const ours = document.activeElement === document.body || pressed === nodeKey;
      if (island && ours && !island.contains(document.activeElement) && holdsCaret()) takeKeyboard(island);
      // Lexical sets the island's editability on reconcile only, so a role change is applied here each time.
      const editable = editor.isEditable();
      const shut = editor.getEditorState().read(() => $openValueReadOnly(nodeKey, token, values, editable));
      locked.current = shut;
      if (island) island.contentEditable = String(!shut);
      setReadOnly(!shut ? null : editable ? 'value' : 'field');
      const caretKey = editor.getEditorState().read($caretChipKey);
      const focused = !!editor.getRootElement()?.contains(document.activeElement);
      setActive(activeValueKey(caretKey, focused, pressed) === nodeKey);
      if (!shut && island) answerEditValue();
    };
    /**
     * "Edit Value" in a chip's flyout is answered here, once the value it asked for exists to take the
     * caret. A mirror's ask is answered by the copy that edits the value, so only one caret ever lands.
     * Focusing the island re-enters `mount` through the editor's own `focusin`, and `settle` only reaches
     * this closure on the next render, so the answered key is held here to keep the answer to one.
     */
    const answerEditValue = () => {
      if (asked === null || answered.current === asked) return;
      if (editor.getEditorState().read(() => $editableCopyKey(asked, values)) !== nodeKey) return;
      answered.current = asked;
      settle();
      caretToEnd();
    };
    // Focus moving within the editor is not a blur.
    const onFocusOut = (e: FocusEvent) => {
      const root = editor.getRootElement();
      if (!(e.relatedTarget instanceof Node && root?.contains(e.relatedTarget))) setActive(false);
    };
    const root = editor.getRootElement();
    root?.addEventListener('focusin', mount);
    root?.addEventListener('focusout', onFocusOut);
    mount();
    const unregister = editor.registerUpdateListener(mount);
    return () => {
      unregister();
      root?.removeEventListener('focusin', mount);
      root?.removeEventListener('focusout', onFocusOut);
    };
  }, [editor, nodeKey, token, values, asked, settle, pressed, caretToEnd]);

  const color = vocab.color(token);

  return (
    <span
      data-open-value
      data-read-only={readOnly ?? undefined}
      data-active={active || undefined}
      style={color ? { '--chip': color, '--chip-ink': '#000' } as CSSProperties : undefined}
    >
      {/* The compact header keeps its value label for a pointer, and gives the room back. The tip stays on
          the active header too: `Tip` swaps its whole subtree when the tip goes, which would tear the
          header's own buttons out from under the click that made the value active. */}
      <Tip tip={open?.label} labelsChild={false}>
        {/* A press makes this value active, and lands the caret in it where it takes one. The browser's own
            caret move is swallowed, so the field's scroll and selection only ever move where the editor says. */}
        <span
          data-open-value-header
          contentEditable={false}
          onMouseDown={(e) => {
            e.preventDefault();
            press(nodeKey);
            // A chevron's own value takes the caret back once the step has refilled it, so the press leaves
            // the caret alone: moving it here re-renders the header out from under the click that follows.
            if (!locked.current && !(e.target as HTMLElement).closest('button')) caretToEnd();
          }}
          className="inline-flex select-none items-center gap-px px-[3px] text-meta font-medium leading-normal"
        >
          {vocab.label(token)}
          {open?.mark && <span> · {open.mark}</span>}
          {open?.pager && <Pager {...open.pager} />}
          {readOnly === 'value' && <Lock role="img" aria-label="Read-Only" className="h-3 w-3" />}
          {/* Last, so the length of a label never moves a control: an active header grows to the right. */}
          {open?.label && <span data-open-value-label className={cn('font-normal opacity-75', active ? '' : 'sr-only')}> · {open.label}</span>}
        </span>
      </Tip>
      <span ref={target} data-open-value-text className={cn(SLOT_TARGET_CLASS, readOnly && 'cursor-default')} />
      <svg data-open-value-shape aria-hidden><path /></svg>
    </span>
  );
}

/** A chevron each way around the value's position in its list. */
function Pager({ index, count, step }: OpenValuePager) {
  const shown = Math.max(index, 0) + 1;
  return (
    <>
      <StepButton label="Previous Value" onClick={() => step(-1)}><ChevronLeft className="h-3 w-3" /></StepButton>
      <span className="grid justify-items-center tabular-nums">
        {/* The widest reading holds the width, so stepping never moves the chevron beside it. */}
        <span aria-hidden className="invisible col-start-1 row-start-1">{count}/{count}</span>
        <span aria-hidden className="col-start-1 row-start-1">{shown}/{count}</span>
        <span className="sr-only">Value {shown} of {count}</span>
      </span>
      <StepButton label="Next Value" onClick={() => step(1)}><ChevronRight className="h-3 w-3" /></StepButton>
    </>
  );
}

/** A chevron on the header. The wash is the header's own ink, which the theme picks with the chip color. */
function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="rounded-sm hover:bg-[var(--chip-ink)]/15">
      {children}
    </button>
  );
}
