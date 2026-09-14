import { useState } from 'react';
import { toast } from 'react-toastify';
import { Checkbox } from '@/components/ui/checkbox';
import { Tip } from '@/components/ui/tooltip';
import { bundledContentLinked, embedBundled } from '@/lib/worldBundle';
import { linkBundledContent } from '@/lib/worldBundleRun';
import WorldStorageService from '@/services/WorldStorageService';
import type { World } from '@/types';

/** What one bundled choice is about: the stored world, and how the host takes the rewritten content back. */
export interface BundledContentChoiceProps {
  worldId: string;
  /** The world's content as the host holds it. */
  data: World | null | undefined;
  /** The rewritten content, once the choice is applied and stored. */
  onApplied: (data: World) => void;
}

/**
 * The imported world's **Link bundled content to My Library** choice.
 *
 * A world file carries complete copies of the content it followed. Linked, each copy follows a library
 * item of the player's own and later source revisions reach it through update review. Unlinked, the
 * copies are embedded and follow nothing. Either way the world holds the content the file shipped.
 *
 * Draws nothing for a world carrying no bundled content, which is every world but an imported one.
 */
export function BundledContentChoice({ worldId, data, onApplied }: BundledContentChoiceProps) {
  const [busy, setBusy] = useState(false);
  const linked = data ? bundledContentLinked(data) : null;
  if (linked === null || !data) return null;

  const apply = async (next: boolean) => {
    setBusy(true);
    try {
      const revised = next ? (await linkBundledContent(data)).world : embedBundled(data);
      // The storage seam takes the loose record shape it stores; the world is exact above it.
      await WorldStorageService.updateWorldContent(worldId, () => revised as unknown as Record<string, unknown>);
      onApplied(revised);
      toast.success(next
        ? 'This world\'s bundled content is in your library.'
        : 'This world\'s bundled content is embedded.');
    } catch (error) {
      toast.error((error as Error).message || 'Could not change what this world\'s content follows.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="link-bundled-content"
        checked={linked}
        disabled={busy}
        onCheckedChange={(checked) => { void apply(checked === true); }}
      />
      <Tip tip="Keep this world's content in your library, so other worlds can use it and source updates reach it.">
        <label htmlFor="link-bundled-content" className="text-label cursor-pointer">
          Link bundled content to My Library
        </label>
      </Tip>
    </div>
  );
}
