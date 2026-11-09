import type { ComponentProps, ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { EntityVisual } from './EntityVisual';
import { hasEntityVisual, type EntityVisualSource } from '@/lib/entityVisual';
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
 * The entity card's body, which an item's popup borrows: the picture, then the description area and the entity's sound. `children` is
 * the description area. The visual props are the gameplay-held picture state `EntityVisual` takes.
 * `sideBySide` puts the picture left of the text on large screens; it needs a host with a fixed height.
 */
export function EntityCardBody({ entity, children, sideBySide = false, images, avatar, preference, onPreferenceChange, imageIndex, onImageStep, morphValues, onMorphNames }: {
  entity: EntityVisualSource & Pick<Entity, 'sound'>;
  children: ReactNode;
  sideBySide?: boolean;
} & Pick<ComponentProps<typeof EntityVisual>, 'images' | 'avatar' | 'preference' | 'onPreferenceChange' | 'imageIndex' | 'onImageStep' | 'morphValues' | 'onMorphNames'>) {
  return (
    <div className={cn('flex-grow min-h-0 flex flex-col gap-4 p-4', sideBySide && 'lg:flex-row lg:gap-6')}>
      {/* Picture takes 3/4 of the height, or 3/5 of the width side by side (aspect ratio preserved). */}
      {(hasEntityVisual(entity) || !!avatar) && (
        <div className="flex-[3] min-h-0 min-w-0 flex items-center justify-center">
          <EntityVisual
            className={sideBySide ? 'lg:items-start' : undefined}
            entity={entity}
            images={images}
            avatar={avatar}
            preference={preference}
            onPreferenceChange={onPreferenceChange}
            imageIndex={imageIndex}
            onImageStep={onImageStep}
            morphValues={morphValues}
            onMorphNames={onMorphNames}
          />
        </div>
      )}
      {/* Stacked, short content sits vertically centered (min-h-full + justify-center). Side by side, it starts
          level with the picture. Long content scrolls from the top. */}
      <ScrollArea className={cn('flex-1 min-h-0 min-w-0', sideBySide && 'lg:flex-[2]')}>
        <div className={cn('min-h-full flex flex-col justify-center', sideBySide && 'lg:justify-start')}>
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
