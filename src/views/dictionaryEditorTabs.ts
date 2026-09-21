export const DICTIONARY_EDITOR_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'dictionary', label: 'Dictionary' },
  { value: 'placeholders', label: 'Placeholders' },
] as const;

export type DictionaryEditorTab = (typeof DICTIONARY_EDITOR_TABS)[number]['value'];
