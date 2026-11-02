import { Info } from 'lucide-react';
import { ELEMENT_ICONS } from '@/lib/elementIcons';

export const DICTIONARY_EDITOR_TABS = [
  { value: 'overview', label: 'Overview', icon: Info },
  { value: 'dictionary', label: 'Dictionary', icon: ELEMENT_ICONS.dictionary },
  { value: 'placeholders', label: 'Placeholders', icon: ELEMENT_ICONS.placeholder },
] as const;

export type DictionaryEditorTab = (typeof DICTIONARY_EDITOR_TABS)[number]['value'];
