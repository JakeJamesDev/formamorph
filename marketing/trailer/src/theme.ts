import { loadVariableFont as loadBaloo2 } from '@remotion/google-fonts/Baloo2';
import { loadFont as loadLexend } from '@remotion/google-fonts/Lexend';

// The loader holds each frame until the fonts are ready, so a render never captures a fallback face.
const lexend = loadLexend('normal', { weights: ['300'], subsets: ['latin'] });
const baloo2 = loadBaloo2('normal', { subsets: ['latin'] });

export const fonts = {
  body: `'${lexend.fontFamily}', sans-serif`,
  wordmark: `'${baloo2.fontFamily}', '${lexend.fontFamily}', sans-serif`,
};

/** Shade over the shots, at the given opacity. */
export const shade = (alpha: number) => `rgba(10, 12, 16, ${alpha})`;

/** The dark stage palette, from the build-assets title card. */
export const colors = {
  stage: 'hsl(220 12% 10%)',
  foreground: 'hsl(220 10% 96%)',
  muted: 'hsl(220 8% 66%)',
  wordmarkGradient: 'linear-gradient(95deg, #a78bfa 0%, #f0abfc 55%, #fb7185 100%)',
};
