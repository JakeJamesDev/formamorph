import { Label } from '@/components/ui/label';
import { TokenAutocomplete } from '@/components/TokenAutocomplete';
import { useDanbooruTags } from '@/lib/useDanbooruTags';
import { Hint } from '@/components/ui/typography';

/**
 * Listing tags, as the World Editor's Overview edits them.
 *
 * One component for all three kinds so an entity and a dictionary are tagged from the same vocabulary a world
 * is — the catalog filters across every kind at once, and two tag inputs offering different suggestions
 * would quietly split it into separate tag spaces.
 */
export function TagsField({ values, onChange, label = 'Tags' }: {
  values: string[] | undefined;
  onChange: (tags: string[]) => void;
  label?: string;
}) {
  const tagOptions = useDanbooruTags();

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <TokenAutocomplete
        values={values || []}
        onChange={onChange}
        options={tagOptions}
        preserveOrder
        reorderable
        editable
        placeholder="Add tags"
      />
      <Hint>Shows on your Community Creations listing, where players filter by tags</Hint>
    </div>
  );
}
