import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { Label } from '@/components/ui/label';
import { TagsField } from '@/components/TagsField';
import { ImageUpload } from '@/lib/UtilityComponents';
import { IMAGE_CAPS } from '@/lib/imageOptim';
import type { Dictionary } from '@/types';

/**
 * How a book looks in the catalog: its tags and its cover.
 *
 * Only the listing fields. What the book *is* — its name, its note, whether it is on — stays beside the
 * entry tree where it has always been, because that is what you reach for while writing entries; these
 * two are set once, when it goes out.
 */
const DictionaryOverviewManager = ({ book }: { book: Dictionary }) => {
  const { updateDictionary } = useDictionaryStore();

  return (
    <div className="space-y-6 max-w-[560px]">
      <TagsField values={book.tags} onChange={(tags) => updateDictionary({ ...book, tags })} />

      <div className="space-y-2">
        <Label htmlFor="image-upload-dictionary-thumbnail">Cover Image</Label>
        {/* Capped like a world's thumbnail, and for the same reason: a book downloads as one JSON file
            carrying this inline, so a full-size cover would dwarf the text it is decorating. */}
        <ImageUpload
          id="dictionary-thumbnail"
          value={book.thumbnail ?? null}
          onChange={(thumbnail) => updateDictionary({ ...book, thumbnail })}
          cap={IMAGE_CAPS.thumbnail}
          objectFit="cover"
          previewClassName="w-full max-w-[400px] aspect-video relative rounded-md hover:border-muted-foreground transition-colors"
        />
        <p className="text-meta text-muted-foreground">
          Optional. A dictionary published without one gets a stand-in cover.
        </p>
      </div>
    </div>
  );
};

export default DictionaryOverviewManager;
