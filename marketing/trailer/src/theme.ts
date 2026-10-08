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

/** The dark stage palette, from the build-assets title card. */
export const colors = {
  stage: 'hsl(220 12% 10%)',
  foreground: 'hsl(220 10% 96%)',
  muted: 'hsl(220 8% 66%)',
  panel: 'hsla(220 12% 13% / 0.88)',
  border: 'hsl(220 10% 26%)',
  accent: '#a78bfa',
  wordmarkGradient: 'linear-gradient(95deg, #a78bfa 0%, #f0abfc 55%, #fb7185 100%)',
};
