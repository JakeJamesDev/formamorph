import { act, render, screen, waitFor } from '@testing-library/react';
import { it, expect } from 'vitest';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isRangeSelection, PASTE_COMMAND, type LexicalEditor, type ParagraphNode } from 'lexical';
import { PromptTokenPastePlugin } from './PromptTokenPastePlugin';
import { VariableNode } from './VariableNode';
import { serializeRoot } from './promptFieldState';
import { promptVocabulary } from '@/lib/chipVocabulary';

it('pastes at the browser caret before Lexical receives its selectionchange', async () => {
  let editor: LexicalEditor;
  function CaptureEditor() {
    [editor] = useLexicalComposerContext();
    return null;
  }
  render(<LexicalComposer initialConfig={{ namespace: 'paste-race', nodes: [VariableNode],
    onError: error => { throw error; }, editorState: () => {
      $getRoot().append($createParagraphNode().append($createTextNode('Before')));
    } }}>
    <PlainTextPlugin contentEditable={<ContentEditable aria-label="Paste target" />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
    <CaptureEditor />
    <PromptTokenPastePlugin vocab={promptVocabulary([])} />
  </LexicalComposer>);
  const token = '<PERSONA|name.xml|header="NPC notes">';
  const event = new Event('paste', { cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => token } });
  act(() => {
    editor.update(() => {
      $getRoot().getFirstChildOrThrow<ParagraphNode>().select(0, 1);
      const text = screen.getByRole('textbox', { name: 'Paste target' }).querySelector('[data-lexical-text]')!.firstChild!;
      // Dispatch within the pending update that still holds the preceding selection.
      document.getSelection()!.collapse(text, text.textContent!.length);
      const selection = $getSelection();
      expect($isRangeSelection(selection) && !selection.isCollapsed()).toBe(true);
      expect(document.getSelection()!.isCollapsed).toBe(true);
      editor.dispatchCommand(PASTE_COMMAND, event as ClipboardEvent);
    }, { discrete: true });
  });
  await waitFor(() => expect(editor.getEditorState().read(serializeRoot)).toBe(`Before${token}`));
  expect(screen.getByText('<npc_notes>')).toBeInTheDocument();
  expect(event.defaultPrevented).toBe(true);
});
