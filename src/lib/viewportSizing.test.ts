import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

/**
 * The keyboard-aware sizing is split across three files that only work together, and two of the three
 * are plain text no unit test would otherwise touch. These assert the contract between them.
 */
describe('keyboard-aware viewport sizing', () => {
  it('paints the root itself so nothing shows through under the Fullscreen API', () => {
    const css = read('src/index.css');

    // With a background only on body, body's background propagates to the canvas and body paints
    // nothing. Fullscreen sizes the element to the screen while the canvas covers only the layout
    // viewport, so the strip the on-screen keyboard shrank away falls through to the UA's black
    // `::backdrop` — black in both themes, and unreachable from any component.
    expect(css).toMatch(/\bhtml\s*\{[^}]*bg-background/);
    expect(css).toMatch(/:fullscreen::backdrop\s*\{[^}]*bg-background/);
  });

  it('frames every top-level view on the measured viewport', () => {
    // A view left on a viewport unit sizes itself to whichever viewport the browser did or did not
    // shrink, which is the thing that kept not matching what was on screen.
    for (const view of ['GameViewer', 'MainMenu', 'WorldEditor', 'CharacterCustomization']) {
      const src = read(`src/views/${view}.tsx`);
      expect(src, `${view} is not framed on the measured viewport`).toContain('app-viewport');
      expect(src, `${view} still sizes itself off a viewport unit`).not.toMatch(/(?<!max-)h-\[(var\(--app-h[^)]*\))?100dvh\]|h-\[100dvh\]/);
    }
  });

  it('defines the frame against the measured rect, with a whole-viewport fallback', () => {
    const css = read('src/index.css');
    const block = /\.app-viewport\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

    expect(block).toMatch(/position:\s*fixed/);
    expect(block).toMatch(/height:\s*var\(--app-h,\s*100dvh\)/);
    // The offset is what makes it follow an engine that pans the visible area instead of resizing it.
    expect(block).toMatch(/top:\s*var\(--app-top,\s*0px\)/);
  });
});
