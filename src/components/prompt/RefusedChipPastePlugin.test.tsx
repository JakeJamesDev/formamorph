import { act, render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { toast } from 'react-toastify';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $createParagraphNode, $getRoot, COMMAND_PRIORITY_LOW, PASTE_COMMAND, type LexicalEditor } from 'lexical';
import { RefusedChipPastePlugin } from './PromptTokenPastePlugin';
import { blueprintChipsRemovedNotice } from '@/lib/blueprintChips';
import { VariableNode } from './VariableNode';
import { serializeRoot } from './promptFieldState';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import type { Placeholder } from '@/types';

const garb: Placeholder = { id: 'garb', name: 'Garb', values: [{ id: 'v1', text: 'tabard' }] };
const town: Placeholder = { id: 'town', name: 'Town', values: [{ id: 'v2', text: 'Harrow' }] };
const GARB = '{{ph:garb:world:p1}}';
const TOWN = '{{ph:town:world:p2}}';

/** Paste `text` into an empty field whose vocabulary refuses `refused`: the field's value, the event, and
 *  whether the paste reached the field's own handling. */
function paste(text: string, refused: string[]) {
  let editor: LexicalEditor;
  let fellThrough = false;
  function CaptureEditor() {
    [editor] = useLexicalComposerContext();
    // Stands in for the field's own paste, which jsdom cannot run.
    editor.registerCommand(PASTE_COMMAND, () => { fellThrough = true; return true; }, COMMAND_PRIORITY_LOW);
    return null;
  }
  const vocab = placeholderVocabulary([garb, town], { blueprints: new Set(refused), refusesBlueprints: true });
  render(<LexicalComposer initialConfig={{ namespace: 'refused-paste', nodes: [VariableNode],
    onError: (error) => { throw error; }, editorState: () => { $getRoot().append($createParagraphNode()); } }}>
    <PlainTextPlugin contentEditable={<ContentEditable aria-label="Paste target" />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
    <CaptureEditor />
    <RefusedChipPastePlugin vocab={vocab} />
  </LexicalComposer>);
  const event = new Event('paste', { cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  act(() => {
    editor.update(() => {
      $getRoot().getFirstChildOrThrow<ReturnType<typeof $createParagraphNode>>().select(0, 0);
      editor.dispatchCommand(PASTE_COMMAND, event as ClipboardEvent);
    }, { discrete: true });
  });
  return { value: editor!.getEditorState().read(serializeRoot), event, fellThrough };
}

afterEach(() => vi.restoreAllMocks());

describe('RefusedChipPastePlugin', () => {
  it('drops each refused blueprint chip, keeps the text and other chips, and says how many went', () => {
    const info = vi.spyOn(toast, 'info');
    const { value, event, fellThrough } = paste(`In ${GARB} at ${TOWN}, ${GARB}.`, ['garb']);
    expect(value).toBe(`In  at ${TOWN}, .`);
    expect(event.defaultPrevented).toBe(true);
    expect(fellThrough).toBe(false);
    expect(info).toHaveBeenCalledWith(blueprintChipsRemovedNotice(2, 'paste'));
  });

  it('leaves a paste the field takes to the field’s own paste', () => {
    const info = vi.spyOn(toast, 'info');
    const { event, fellThrough } = paste(`In ${GARB}.`, []);
    expect(event.defaultPrevented).toBe(false);
    expect(fellThrough).toBe(true);
    expect(info).not.toHaveBeenCalled();
  });
});
