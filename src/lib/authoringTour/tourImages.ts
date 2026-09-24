/**
 * The tour's example pictures. They ship as bundled files and load on demand, so the editor's bundle does not
 * carry them; Use Example stores one the way an upload does, as a data URL in the world.
 */
import { fileToDataUrl } from '@/lib/imageDrop';
import brinewell from './assets/brinewell.webp';
import tidewell from './assets/tidewell.webp';
import saltLantern from './assets/salt-lantern.webp';
import maren from './assets/maren.webp';

export type TourImage = 'brinewell' | 'tidewell' | 'saltLantern' | 'maren';

const URLS: Record<TourImage, string> = { brinewell, tidewell, saltLantern, maren };

/** The bundled picture as a data URL. Rejects when the file cannot be fetched. */
export async function loadTourImage(name: TourImage): Promise<string> {
  const response = await fetch(URLS[name]);
  if (!response.ok) throw new Error(`Could not load the ${name} picture (${response.status}).`);
  const blob = await response.blob();
  return fileToDataUrl(new File([blob], `${name}.webp`, { type: blob.type || 'image/webp' }));
}
