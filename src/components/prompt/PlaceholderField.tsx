import { useMemo } from 'react';
import PromptField from './PromptField';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import type { Placeholder } from '@/types';

/**
 * A chip editor for world text that can embed placeholders. Reuses the prompt chip editor with the
 * placeholder token family: the toolbar inserts the world's placeholders, and a Wildcard chip's pop-out
 * offers World | Unique (only once it has 2+ values). Stores the same token-string as the rest of the field.
 */
const PlaceholderField = ({ value, onChange, placeholders, className, readOnly = false }: {
  value: string;
  onChange: (v: string) => void;
  placeholders: Placeholder[];
  className?: string;
  readOnly?: boolean;
}) => {
  const vocab = useMemo(() => placeholderVocabulary(placeholders), [placeholders]);
  return <PromptField value={value} onChange={onChange} vocabulary={vocab} className={className} readOnly={readOnly} />;
};

export default PlaceholderField;
