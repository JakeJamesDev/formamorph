import { useContext, useLayoutEffect, useRef } from 'react';
import { mountSlotContainer, type NodeKey } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ChipVocabularyContext } from '@/lib/chipVocabulary';
import { tintMarkStyle } from '@/lib/previewTint';
import { OpenValuesContext, VALUE_SLOT } from './openValueContext';

// Lexical parks the slot container, its value box and the box's paragraph as blocks; a value reads inline.
const SLOT_TARGET_CLASS = '[&>*]:inline [&>*>*]:inline [&>*>*>*]:inline';

/**
 * A chip open on the Values tab: a header naming the placeholder and the open value, then the value itself.
 * The value lives in the node's named slot, which Lexical renders apart and this chip mounts in place.
 */
export function OpenValueChip({ nodeKey, token }: { nodeKey: NodeKey; token: string }) {
  const [editor] = useLexicalComposerContext();
  const vocab = useContext(ChipVocabularyContext);
  const open = useContext(OpenValuesContext)[token];
  const target = useRef<HTMLSpanElement>(null);

  // A refill reparks the container, so it mounts again after every update. Mounting in place is a no-op.
  useLayoutEffect(() => {
    const mount = () => { if (target.current) mountSlotContainer(editor, nodeKey, VALUE_SLOT, target.current); };
    mount();
    return editor.registerUpdateListener(mount);
  }, [editor, nodeKey]);

  return (
    <span
      data-open-value
      className="rounded px-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
      style={tintMarkStyle(vocab.color(token))}
    >
      <span contentEditable={false} className="mr-1 select-none whitespace-nowrap text-meta font-medium text-muted-foreground">
        {vocab.label(token)}
        {open?.label && <span className="font-normal"> · {open.label}</span>}
      </span>
      <span ref={target} data-open-value-text className={SLOT_TARGET_CLASS} />
    </span>
  );
}
