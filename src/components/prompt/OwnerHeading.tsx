import { BookOpen, User } from 'lucide-react';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import type { PlaceholderOwnerRef } from '@/lib/placeholderHomes';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';

/** What each owner kind is called where the icon needs a name of its own. */
const OWNER_LABEL: Record<PlaceholderOwnerRef['kind'], string> = { entity: 'Entity', dictionary: 'Dictionary' };

/** The mark that says which kind of owner a name belongs to — on a section's heading, and on the closed
 *  trigger of a picker that settled on one of that owner's placeholders. */
export const OwnerIcon = ({ kind, className }: { kind: PlaceholderOwnerRef['kind']; className?: string }) => {
  const Icon = kind === 'entity' ? User : BookOpen;
  return <Icon role="img" aria-label={OWNER_LABEL[kind]} className={cn('h-3 w-3 shrink-0', className)} />;
};

/**
 * The heading an entity's or a book's own placeholders sit under, in every sectioned surface: the palette
 * bar, the `{` typeahead, the drill picker, the Pins dropdown and the find bar's picker.
 *
 * Quiet text like a folder's heading, with the owner's icon as the one thing that tells the two apart. A
 * heading is not something to place, so it wears no chip of its own — the colored chips under it are the
 * click targets, and a headline that looked like one of them would invite a click that does nothing. An
 * owner named with a placeholder still shows that placeholder as a pill, since that is what it is, but a
 * neutral one: in its own accent it would read as a chip waiting to be dropped into a field.
 */
const OwnerHeading = ({ kind, name, placeholders, className }: {
  kind: PlaceholderOwnerRef['kind'];
  /** The owner's name as authored, chips and all. */
  name: string;
  /** Everything a chip in the name could point at, so the nested pill resolves. */
  placeholders: readonly Placeholder[];
  className?: string;
}) => {
  return (
    <span className={cn('inline-flex items-center gap-1 text-meta text-muted-foreground', className)}>
      <OwnerIcon kind={kind} />
      <PlaceholderText text={name} placeholders={placeholders} neutral />
    </span>
  );
};

export default OwnerHeading;
