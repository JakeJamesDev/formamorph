import { Label } from '@/components/ui/label';
import { TokenAutocomplete } from '@/components/TokenAutocomplete';
import { useDanbooruTags } from '@/lib/useDanbooruTags';

/**
 * Listing tags, as the World Editor's Overview edits them.
 *
 * One component for all three kinds so a character and a book are tagged from the same vocabulary a world
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
        placeholder="Add tags..."
      />
      <p className="text-meta text-muted-foreground">
        Shown on the listing in Community Creations, and what people filter by when browsing.
      </p>
    </div>
  );
}
