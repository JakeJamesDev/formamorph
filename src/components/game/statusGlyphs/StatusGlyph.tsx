import type { ReactElement } from 'react';
import { BookOpen } from './animate-ui/icons/book-open';
import { ChartColumnIncreasing } from './animate-ui/icons/chart-column-increasing';
import { Compass } from './animate-ui/icons/compass';
import { Hammer } from './animate-ui/icons/hammer';
import { Hourglass } from './animate-ui/icons/hourglass';
import { MapPin } from './animate-ui/icons/map-pin';
import { Scroll } from './animate-ui/icons/scroll';
import { Sparkles } from './animate-ui/icons/sparkles';
import type { StatusGlyphKey } from './glyphMap';
import { Masks } from './icons/masks';
import { Quill } from './icons/quill';
import { Split } from './icons/split';
import { ThoughtCloud } from './icons/thought-cloud';

/** The pause between two runs of a glyph's loop. */
const GLYPH_LOOP_DELAY_MS = 400;

const LOOP = { animate: true, loop: true, loopDelay: GLYPH_LOOP_DELAY_MS, size: 16 } as const;

const GLYPHS: Record<StatusGlyphKey, () => ReactElement> = {
  compass: () => <Compass {...LOOP} animation="default-loop" />,
  chartColumnIncreasing: () => <ChartColumnIncreasing {...LOOP} animation="default-loop" />,
  bookOpen: () => <BookOpen {...LOOP} animation="default" />,
  scroll: () => <Scroll {...LOOP} animation="default" />,
  mapPin: () => <MapPin {...LOOP} animation="default" />,
  hourglass: () => <Hourglass {...LOOP} animation="default" />,
  sparkles: () => <Sparkles {...LOOP} animation="default" />,
  hammer: () => <Hammer {...LOOP} animation="default" />,
  quill: () => <Quill {...LOOP} animation="default" />,
  masks: () => <Masks {...LOOP} animation="default" />,
  split: () => <Split {...LOOP} animation="default" />,
};

/** One looping status glyph at the label's size. */
export function StatusGlyph({ glyph }: { glyph: StatusGlyphKey }) {
  return GLYPHS[glyph]();
}

/** The Thinking header's looping thought cloud, at the header's size. */
export function ThinkingGlyph() {
  return <ThoughtCloud {...LOOP} size={14} animation="default" />;
}
