/**
 * Supporter mascots: installed Supporter content of the Mascot kind, as a read-only preset. The content is a
 * Mascot card whose image table holds scrambled layers. The preset keeps the rig and names each layer by its
 * place in that table; the pixels stay in the Supporter content cache.
 */
import { isScrambledLayer, type ScrambledLayer } from '@/lib/supporterContent/scramble';
import { isRecord } from '@/lib/tools/toolValidation';
import type { MascotImageRef, MascotRig } from './mascot';
import { parseMascotCardData } from './mascotCard';
import { supporterMascotId, type MascotPreset, type SupporterMascotSource } from './mascotPresets';

/** The name a Supporter mascot takes when its card has none. */
export const SUPPORTER_MASCOT_FALLBACK_NAME = 'Supporter Mascot';

/**
 * The preset of one installed Supporter mascot.
 *
 * @throws Error naming the bad field when the content is not a Mascot card of scrambled layers
 */
export function supporterMascotFromContent(item: SupporterMascotSource, content: unknown): MascotPreset {
  if (!isRecord(content) || !Array.isArray(content.images)) throw new Error('This Supporter content is not a Mascot card.');
  const layers = content.images;
  layers.forEach((layer, index) => {
    if (!isScrambledLayer(layer)) throw new Error(`This Supporter Mascot has a missing or bad layer: images.${index}.`);
  });
  // The card codec checks every other field; it reads each layer as the data URL it carries.
  const card = parseMascotCardData({ ...content, images: (layers as ScrambledLayer[]).map((layer) => layer.dataUrl) });
  const ref = (index: number): MascotImageRef => ({ kind: 'supporter', id: item.listingId, revision: item.revision, index });
  const { base, layers: rows, ...rest } = card.rig;
  const rig: MascotRig = { ...rest, base: ref(base), layers: rows.map((row) => ({ ...row, images: row.images.map(ref) })) };
  return {
    id: supporterMascotId(item.listingId),
    name: card.name ?? SUPPORTER_MASCOT_FALLBACK_NAME,
    rig,
    supporter: { ...item },
  };
}

/** The scrambled layer a Supporter ref names, or null when the content has none there. */
export function supporterLayerOf(content: unknown, index: number): ScrambledLayer | null {
  if (!isRecord(content) || !Array.isArray(content.images)) return null;
  const layer: unknown = content.images[index];
  return isScrambledLayer(layer) ? layer : null;
}
