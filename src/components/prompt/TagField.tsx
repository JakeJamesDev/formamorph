import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import TagHistoryButtons from '@/components/TagHistoryButtons';
import { useTagHistory } from '@/lib/useTagHistory';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';
import TagChipField from './TagChipField';

/**
 * A booru tag line with the chrome that belongs to one: undo/redo stepped by tag, and the Danbooru
 * autocomplete the chip field brings. Every field the author types tags into is built from this, so the
 * Image Tags in the editor, the prompt boxes in the generate dialog, the scene tags in play and the global
 * prefixes in Settings are the same control rather than four that drifted apart.
 *
 * `label` is the heading above the field. A caller whose surrounding layout already draws one (a settings
 * row, a panel with its own heading) leaves it off and passes `ariaLabel` instead; the buttons then sit
 * alone on the line above the field.
 */
const TagField = ({ label, value, onChange, placeholders = [], ownerId, placeholder, ariaLabel, aside, className }: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholders?: Placeholder[];
  /** The entity or location whose field this is — see `ownerId` on `PlaceholderField`. */
  ownerId?: string;
  placeholder?: string;
  /** Names the field when no visible `label` is drawn. */
  ariaLabel?: string;
  /** Extra controls for the button row — the AI tag writer, on the fields that have one. */
  aside?: ReactNode;
  className?: string;
}) => {
  const history = useTagHistory(value, onChange);
  return (
    <div className="space-y-1">
      <div className={cn('flex items-center gap-1', label ? 'justify-between' : 'justify-end')}>
        {/* No `htmlFor`: the field is a contenteditable, which a label cannot point at. */}
        {label && <Label className="leading-none">{label}</Label>}
        <div className="flex items-center gap-1">
          {aside}
          {aside && <span className="mx-0.5 h-4 w-hairline bg-border" aria-hidden />}
          <TagHistoryButtons history={history} />
        </div>
      </div>
      <TagChipField
        value={value}
        onChange={onChange}
        placeholders={placeholders}
        ownerId={ownerId}
        placeholder={placeholder}
        ariaLabel={ariaLabel ?? label}
        className={className}
      />
    </div>
  );
};

export default TagField;
