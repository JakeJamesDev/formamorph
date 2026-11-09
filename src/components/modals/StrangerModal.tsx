import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntityCardBody, EntityDescription } from '../game/EntityCard';
import { EntityAvatar } from '../game/EntityAvatar';
import { usePlayAvatars } from '@/lib/usePlayAvatars';
import { useEntityTextResolver } from "@/lib/usePlaceholderResolver";
import { useEntityVisualPreference } from "@/lib/useEntityVisualPreference";
import { useEntityGallery } from "@/lib/useEntityGallery";
import { useEntityStatMorphs } from "@/lib/useEntityStatMorphs";
import type { Entity } from "@/types";

/** The popup for someone the player has not met: the label, the image and the Stranger Description. */
export const StrangerModal = ({ entity, label, isOpen, onOpenChange }: {
  entity: Entity | null;
  /** What the player knows the stranger as. */
  label: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const resolveEntityText = useEntityTextResolver();
  const { preference, onPreferenceChange } = useEntityVisualPreference(entity?.id);
  // The copy carries the label for a name and drops every other field that could say who this is.
  const shown = entity ? { ...entity, name: label, sound: undefined } : undefined;
  const { images, imageIndex, onImageStep } = useEntityGallery(shown);
  const { morphs: morphValues, onCatalog: onMorphNames } = useEntityStatMorphs(shown);
  const avatars = usePlayAvatars();
  const avatarSource = shown ? avatars.sourceOf(shown) : undefined;

  if (!entity || !shown) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent surface="stranger" aria-describedby={undefined} className="sm:max-w-[800px] lg:max-w-[1040px] h-[90dvh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <EntityCardBody
          sideBySide
          entity={shown}
          images={images}
          avatar={avatarSource && (
            <EntityAvatar entity={shown} source={avatarSource} played={false} resolving={avatars.resolving} />
          )}
          preference={preference}
          onPreferenceChange={onPreferenceChange}
          imageIndex={imageIndex}
          onImageStep={onImageStep}
          morphValues={morphValues}
          onMorphNames={onMorphNames}
        >
          <EntityDescription text={entity.strangerDescription?.trim() ?? ''} resolveText={(text) => resolveEntityText(shown, text)} />
        </EntityCardBody>
      </DialogContent>
    </Dialog>
  );
};
