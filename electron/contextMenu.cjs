// Right-click menu for the desktop shell. Electron ships no default context menu, so without this the
// spellchecker's squiggles are decorative — Chromium finds the misspelling and hands us the suggestions,
// and nothing was listening. Clipboard entries come along because the same gap left the app with no
// cut/copy/paste affordance outside the keyboard.

const MAX_SUGGESTIONS = 5;

/**
 * Build the menu template for one right-click. Pure so the shape can be tested without a running app;
 * `actions` supplies the two effectful calls (replace the word, teach the dictionary).
 */
function contextMenuTemplate(params, actions) {
  const { misspelledWord = '', dictionarySuggestions = [], editFlags = {}, selectionText = '', isEditable = false } = params ?? {};
  const items = [];

  if (misspelledWord) {
    if (dictionarySuggestions.length) {
      for (const suggestion of dictionarySuggestions.slice(0, MAX_SUGGESTIONS)) {
        items.push({ label: suggestion, click: () => actions.replaceMisspelling(suggestion) });
      }
    } else {
      items.push({ label: 'No Spelling Suggestions', enabled: false });
    }
    items.push({ type: 'separator' });
    items.push({ label: 'Add To Dictionary', click: () => actions.addToDictionary(misspelledWord) });
    items.push({ type: 'separator' });
  }

  const hasSelection = Boolean(selectionText);
  if (isEditable) {
    items.push({ role: 'cut', enabled: Boolean(editFlags.canCut) });
    items.push({ role: 'copy', enabled: Boolean(editFlags.canCopy) });
    items.push({ role: 'paste', enabled: Boolean(editFlags.canPaste) });
    items.push({ role: 'selectAll', enabled: Boolean(editFlags.canSelectAll) });
  } else if (hasSelection) {
    items.push({ role: 'copy', enabled: Boolean(editFlags.canCopy) });
  }

  // Drop a leading/trailing separator left behind when a section came out empty.
  while (items.length && items[0].type === 'separator') items.shift();
  while (items.length && items[items.length - 1].type === 'separator') items.pop();
  return items;
}

module.exports = { contextMenuTemplate, MAX_SUGGESTIONS };
