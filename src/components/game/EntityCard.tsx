import type { ComponentProps, ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EntityVisual, hasEntityVisual } from './EntityVisual';
import AudioPlayer from './AudioPlayer';
import type { Entity } from '@/types';

const identity = (text: string) => text;

/** An entity's Player-Facing Description as its card shows it, with room for actions below. `text` is
 *  the authored text; `resolveText` resolves it. */
export function EntityDescription({ text, resolveText = identity, children }: {
  text: string;
  resolveText?: (text: string) => string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {text ? (
        <p>{resolveText(text)}</p>
      ) : (
        <p className="italic text-muted-foreground">No description provided.</p>
      )}
      {children}
    </div>
  );
}

/**
 * The entity card's body: the picture, then the description area and the entity's sound. `children` is
 * the description area. The visual props are the gameplay-held picture state `EntityVisual` takes.
 */
export function EntityCardBody({ entity, children, preference, onPreferenceChange, imageIndex, onImageStep }: {
  entity: Entity;
  children: ReactNode;
} & Pick<ComponentProps<typeof EntityVisual>, 'preference' | 'onPreferenceChange' | 'imageIndex' | 'onImageStep'>) {
  return (
    <div className="flex-grow min-h-0 flex flex-col gap-4 p-4">
      {/* Picture takes 3/4 of the body height (aspect ratio preserved); description fills the rest. */}
      {hasEntityVisual(entity) && (
        <div className="flex-[3] min-h-0 flex items-center justify-center">
          <EntityVisual
            entity={entity}
            preference={preference}
            onPreferenceChange={onPreferenceChange}
            imageIndex={imageIndex}
            onImageStep={onImageStep}
          />
        </div>
      )}
      {/* Scroll area whose content sits vertically centered when short (min-h-full + justify-center)
          and scrolls from the top when long. */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="min-h-full flex flex-col justify-center">
          <div className="flex flex-col gap-4">
            {children}
            {entity.sound && (
              <AudioPlayer src={entity.sound.data} className="w-full" />
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
