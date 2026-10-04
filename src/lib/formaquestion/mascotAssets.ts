/** The URLs of the default rig's bundled images. */
import type { MascotAssetName, MascotImageRef } from './mascot';

const URLS = import.meta.glob<string>('./mascotAssets/*.webp', { eager: true, import: 'default', query: '?url' });

const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1, -'.webp'.length);

const BY_NAME = new Map(Object.entries(URLS).map(([path, url]) => [nameOf(path), url]));

/** The names of the bundled image files. */
export const bundledMascotFiles = (): readonly string[] => [...BY_NAME.keys()];

/** The URL of one bundled image. */
export function mascotAssetUrl(name: MascotAssetName): string {
  const url = BY_NAME.get(name);
  if (url === undefined) throw new Error(`No bundled mascot image named ${name}.`);
  return url;
}

/** The URL of one rig image, or null for a stored image, which has no URL until its blob is read. */
export function mascotImageUrl(ref: MascotImageRef): string | null {
  return ref.kind === 'bundled' ? mascotAssetUrl(ref.name) : null;
}
