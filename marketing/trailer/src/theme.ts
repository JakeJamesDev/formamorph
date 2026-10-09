import { loadVariableFont as loadBaloo2 } from '@remotion/google-fonts/Baloo2';
import { loadFont as loadLexend } from '@remotion/google-fonts/Lexend';
import type { Layout } from './layout';

// The loader holds each frame until the fonts are ready, so a render never captures a fallback face.
const lexend = loadLexend('normal', { weights: ['300', '400', '500'], subsets: ['latin'] });
const baloo2 = loadBaloo2('normal', { subsets: ['latin'] });

export const fonts = {
  body: `'${lexend.fontFamily}', sans-serif`,
  wordmark: `'${baloo2.fontFamily}', '${lexend.fontFamily}', sans-serif`,
};

/** The app's text size roles in CSS pixels (`tailwind.config.js`, `theme.extend.fontSize`). */
export const typeRoles = { display: 24, heading: 20, title: 18, body: 16, label: 14, helper: 14, meta: 12 } as const;

export type TypeRole = keyof typeof typeRoles;

/** How far a role scales up for each canvas, so the ratios between roles stay the app's. */
const TYPE_SCALE: Record<Layout, number> = { wide: 4, tall: 3.5 };

/** A role's size in canvas pixels. */
export const roleSize = (role: TypeRole, layout: Layout) => typeRoles[role] * TYPE_SCALE[layout];

/** Shade over the shots, at the given opacity. */
export const shade = (alpha: number) => `rgba(10, 12, 16, ${alpha})`;

/** The brand palette, as hex so the stage can add alpha to it. */
const brand = { purple: '#a78bfa', pink: '#f0abfc', rose: '#fb7185', amber: '#fbbf24', mint: '#6ee7b7', sky: '#7dd3fc' };

export type DotColor = keyof typeof brand;

/** The dark stage palette, from the build-assets title card. */
export const colors = {
  stage: 'hsl(220 12% 10%)',
  foreground: 'hsl(220 10% 96%)',
  muted: 'hsl(220 8% 66%)',
  panel: 'hsla(220 12% 13% / 0.88)',
  accent: brand.purple,
  wordmarkGradient: `linear-gradient(95deg, ${brand.purple} 0%, ${brand.pink} 55%, ${brand.rose} 100%)`,
  /** The stage's glowing blobs. */
  blobs: { purple: brand.purple, rose: brand.rose, sky: brand.sky },
  /** Caption pill dots. */
  dots: brand,
};

/** The glass surface every card and pill shares. */
export const glass = {
  border: '1px solid rgba(255, 255, 255, 0.12)',
  pill: 'rgba(16, 18, 24, 0.72)',
  shadow: '0 60px 160px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(0, 0, 0, 0.4)',
  depthShadow: '0 40px 120px rgba(0, 0, 0, 0.5)',
  pillShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
};
