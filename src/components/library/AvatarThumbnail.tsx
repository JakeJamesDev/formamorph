import {
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import type { AvatarThumbnailSource, ModelMetadata } from '@/types';

const SOURCE_LABELS: { source: AvatarThumbnailSource; label: string }[] = [
  { source: 'file', label: 'From File' },
  { source: 'generated', label: 'Generated' },
];

/** The Avatar tile menu's Thumbnail choice. Renders nothing when the file has no embedded image. */
export function AvatarThumbnailMenuItems({ model, onChange }: {
  model: Pick<ModelMetadata, 'hasFileThumbnail' | 'thumbnailSource'>;
  onChange: (source: AvatarThumbnailSource) => void;
}) {
  if (!model.hasFileThumbnail) return null;
  const active = model.thumbnailSource ?? 'file';
  return (
    <>
      <ContextMenuSeparator />
      <ContextMenuLabel>Thumbnail</ContextMenuLabel>
      <ContextMenuRadioGroup
        value={active}
        onValueChange={(value) => {
          const picked = SOURCE_LABELS.find(({ source }) => source === value)?.source;
          if (picked && picked !== active) onChange(picked);
        }}
      >
        {/* The shared radio item takes its checked state explicitly. */}
        {SOURCE_LABELS.map(({ source, label }) => (
          <ContextMenuRadioItem key={source} value={source} checked={active === source}>
            {label}
          </ContextMenuRadioItem>
        ))}
      </ContextMenuRadioGroup>
      <ContextMenuSeparator />
    </>
  );
}
