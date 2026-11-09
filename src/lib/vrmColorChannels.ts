import type * as THREE from "three";
import type { ColorChannel } from "@/types";
import { dominantClusterRGB, tintSeedRGB, toByte } from "./textureMedian";
import { COLOR_CHANNELS } from "./avatarLook";

const CLOTH_WORDS = ['cloth', 'top', 'bottom', 'shoe', 'skirt', 'pant', 'shirt', 'dress', 'jacket', 'sock', 'glove', 'sleeve', 'coat', 'bra', 'accessor'];

/**
 * Whether a material belongs to a color channel, by material name or mesh name, so it works across VRoid
 * (materials like *_SKIN, *_HAIR, EyeIris) and other rigs (meshes named Body, Hair). Clothing is never skin, so
 * garments sharing the Body mesh keep their colors.
 */
export function channelMatch(channel: string, matName: string, meshName: string): boolean {
  const m = (matName || '').toLowerCase();
  const mesh = (meshName || '').toLowerCase();
  if (channel === 'hair') return m.includes('hair') || mesh.includes('hair');
  if (channel === 'eye') return m.includes('iris') || (m.includes('eye') && !/white|highlight|lash|line|brow/.test(m));
  if (channel === 'skin') {
    if (m.includes('hair') || m.includes('eye') || m.includes('iris') || CLOTH_WORDS.some(w => m.includes(w))) return false;
    return m.includes('skin') || mesh.includes('body') || mesh.includes('skin');
  }
  return false;
}

type ChannelMaterial = THREE.Material & { isOutline?: boolean; color?: THREE.Color; map?: THREE.Texture | null };


/** A material's own color as a picker seeds it: its texture's dominant cluster under its color factor, else that factor. */
function materialColor(m: ChannelMaterial): string | null {
  const factor: [number, number, number] = m.color?.isColor ? [m.color.r, m.color.g, m.color.b] : [1, 1, 1];
  const image = m.map?.image as (CanvasImageSource & { width?: number; height?: number }) | undefined;
  let median: [number, number, number] | null = null;
  if (image?.width && image.height && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    try {
      if (ctx) { ctx.drawImage(image, 0, 0); median = dominantClusterRGB(ctx.getImageData(0, 0, image.width, image.height).data); }
    } catch { median = null; }
  }
  if (!median && !m.color?.isColor) return null;
  const rgb = median ? tintSeedRGB(median, factor) : factor;
  return '#' + rgb.map((x) => toByte(x).toString(16).padStart(2, '0')).join('');
}

/** The color channels a model's scene carries a material for, outline copies aside, each with its first
 *  material's own color. */
export function sceneColorChannels(scene: THREE.Object3D): { channels: ColorChannel[]; colors: Partial<Record<ColorChannel, string>> } {
  const first: Partial<Record<ColorChannel, ChannelMaterial>> = {};
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as ChannelMaterial[]) {
      if (!m || m.isOutline) continue;
      for (const channel of COLOR_CHANNELS) if (!first[channel] && channelMatch(channel, m.name, mesh.name)) first[channel] = m;
    }
  });
  const channels = COLOR_CHANNELS.filter((c) => first[c]);
  const colors: Partial<Record<ColorChannel, string>> = {};
  for (const channel of channels) {
    const color = materialColor(first[channel]!);
    if (color) colors[channel] = color;
  }
  return { channels, colors };
}
