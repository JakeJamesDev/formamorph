import { useId, useMemo } from 'react';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Meta } from '@/components/ui/typography';
import type { Guide } from '@/lib/formaquestion/guide';
import { surfaceHelpSection } from '@/lib/surface/surfaceHelp';
import { useSurface } from '@/lib/surface/useSurface';
import { cn } from '@/lib/utils';

/**
 * The guide's first item: the section for the screen, dialog and tab the player has open. It follows
 * the Surface while the window is open, and renders nothing when no section explains the Surface.
 */
export function SurfaceHelpRow({ guide, current, onOpen, className }: {
  guide: Guide;
  /** The section the reader shows. */
  current: string | null;
  onOpen: (id: string) => void;
  className?: string;
}) {
  const labelId = useId();
  const surface = useSurface();
  const section = useMemo(() => {
    const id = surfaceHelpSection(surface, guide);
    return id === null ? null : guide.section(id);
  }, [surface, guide]);
  if (!section) return null;
  return (
    <div role="group" aria-labelledby={labelId} className={cn('flex shrink-0 flex-col gap-1 border-b p-3', className)}>
      <Meta id={labelId}>Help for This Screen</Meta>
      <CompactSelectionRow selected={current === section.id} onClick={() => onOpen(section.id)}>
        {section.label}
      </CompactSelectionRow>
    </div>
  );
}
