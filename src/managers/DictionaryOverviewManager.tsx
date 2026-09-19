import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { Label } from '@/components/ui/label';
import { TagsField } from '@/components/TagsField';
import { FieldColumn } from '@/components/modals/FieldColumn';
import { ImageUpload } from '@/lib/UtilityComponents';
import { IMAGE_CAPS } from '@/lib/imageOptim';
import DictionaryBookFields from './DictionaryBookFields';
import type { Dictionary } from '@/types';

/**
 * Everything about a library book: its tags and cover in a left column from `sm` up, and its Name,
 * Description, and Enabled beside them. One column below `sm`.
 */
const DictionaryOverviewManager = ({ book }: { book: Dictionary }) => {
  const { updateDictionary } = useDictionaryStore();

  return (
    <div className="flex flex-col sm:flex-row">
      <div className="space-y-6 p-4 pb-0 sm:w-80 sm:shrink-0 sm:pb-4 sm:pr-0">
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
            previewClassName="w-full max-w-[400px] aspect-video relative rounded-md"
          />
          <p className="text-meta text-muted-foreground">
            Optional. A dictionary published without one gets a stand-in cover.
          </p>
        </div>
      </div>
      <FieldColumn>
        <DictionaryBookFields book={book} />
      </FieldColumn>
    </div>
  );
};

export default DictionaryOverviewManager;
