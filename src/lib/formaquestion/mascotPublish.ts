import { bytesToDataUrl } from '@/lib/imageBytes';
import { PUBLISH_LIMITS, measureMascotBytes, publishLimitRefusal } from '@/lib/publishLimits';
import { mascotPublishPayload, type PublishPayload } from '@/lib/publishPayload';
import type { MascotRig } from './mascot';
import { buildMascotCardWithLook, type MascotCardExportDeps } from './mascotCardFile';

/** The name a bundled base takes in the refusal. */
const BASE_LABEL = 'Base Image';

/** The parts of a rig that draw the app's own art: the base, and each layer holding a bundled image. */
export function bundledMascotParts(rig: MascotRig): string[] {
  const parts = rig.layers.filter((layer) => layer.images.some((image) => image.kind === 'bundled')).map((layer) => layer.name);
  return rig.base.kind === 'bundled' ? [BASE_LABEL, ...parts] : parts;
}

/** A Mascot that may be published, with the payload ready, or one that may not, with the reason to show. */
export type MascotPublishAttempt =
  | { allowed: true; payload: PublishPayload }
  | { allowed: false; reason: 'bundled'; message: string; parts: string[] }
  | { allowed: false; reason: 'size'; message: string; bytes: number };

/**
 * Judge a custom Mascot and, when it passes, build the payload that publishes it.
 *
 * A Mascot that holds the app's bundled art is refused, as the default Avatar is.
 */
export async function buildMascotPublish(
  name: string, rig: MascotRig, overrides: Partial<MascotCardExportDeps> = {},
): Promise<MascotPublishAttempt> {
  const parts = bundledMascotParts(rig);
  if (parts.length > 0) {
    return {
      allowed: false,
      reason: 'bundled',
      parts,
      message: `This Mascot uses art that ships with Formamorph. Replace it in: ${parts.join(', ')}.`,
    };
  }
  const { card, look } = await buildMascotCardWithLook(name, rig, overrides);
  const bytes = measureMascotBytes(card);
  if (bytes > PUBLISH_LIMITS.mascot) {
    return {
      allowed: false,
      reason: 'size',
      bytes,
      message: `${publishLimitRefusal('mascot', bytes)} Compress the layers, then publish again.`,
    };
  }
  return { allowed: true, payload: mascotPublishPayload(name, card, bytesToDataUrl(look.bytes, 'image/webp')) };
}
