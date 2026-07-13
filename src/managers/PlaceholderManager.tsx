import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeywordChips } from '@/components/KeywordChips';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import type { Placeholder } from '@/types';

/** Right-panel editor for a placeholder: a name and its values. The behavior is inferred from the value
 *  count — 1 value is a fixed Variable, 2+ is a random Wildcard — surfaced as a live hint. Writes back through
 *  the scoped `PlaceholderStore` (the world's, or the library item's isolated store). */
const PlaceholderManager = ({ placeholder }: { placeholder: Placeholder }) => {
  const { updatePlaceholder } = usePlaceholderStore();
  const [editing, setEditing] = useState<Placeholder>(placeholder);

  useEffect(() => {
    setEditing(placeholder);
  }, [placeholder]);

  const apply = (next: Placeholder) => {
    setEditing(next);
    updatePlaceholder(next);
  };

  const count = editing.values.length;
  const hint =
    count === 0
      ? 'No values yet — this resolves to nothing until you add one.'
      : count === 1
        ? 'One value → a Variable: always resolves to this value. Reuse it, edit it here once.'
        : `${count} values → a Wildcard: resolves to a random value. Each chip chooses World (same everywhere) or Unique (its own roll).`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={editing.name} onChange={(e) => apply({ ...editing, name: e.target.value })} placeholder="e.g. Eye Color" />
      </div>
      <div className="space-y-2">
        <Label>Values</Label>
        <KeywordChips
          keywords={editing.values}
          onChange={(values) => apply({ ...editing, values })}
          placeholder="e.g. Red, Blue, Green"
        />
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
};

export default PlaceholderManager;
