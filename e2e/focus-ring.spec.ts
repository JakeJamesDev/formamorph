import { test, expect, type Locator } from '@playwright/test';
import { openApp, gotoDev } from './app';

/**
 * The focus ring draws INSIDE the control (`ring-inset`) so no clipping ancestor can cut it — scroll
 * areas, `overflow-x-auto` toolbars and rounded `overflow-hidden` tables all used to slice the ring off
 * a control sitting flush against their edge.
 *
 * This needs a browser. jsdom loads no stylesheet, so it cannot see a box-shadow, a CSS variable, or the
 * rule ordering these guards depend on:
 *
 *  - `ring-inset` is what makes clipping impossible; without it the ring is drawn outside the box again.
 *  - A filled control (primary/destructive) re-colors its ring to its own foreground, because `--ring`
 *    is tuned against the PAGE and drops to ~1.8:1 inside a filled box in dark mode. That override and
 *    the base `focus-visible:ring-ring` set the same property at the same specificity, so it only wins
 *    on stylesheet order — reordering the Tailwind color config would silently break it.
 */

/** WCAG 2.1 SC 1.4.11: non-text UI components need 3:1 against what's adjacent. */
const MIN_CONTRAST = 3;

/** Relative luminance / contrast per WCAG, run in the page against real computed colors. */
const CONTRAST_FN = `
  (function () {
    const lum = (c) => {
      const [r, g, b] = c.match(/[\\d.]+/g).slice(0, 3).map(Number).map((v) => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    return (a, b) => {
      const l1 = lum(a), l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
  })()
`;

interface RingReading {
  inset: boolean;
  contrast: number;
  bg: string;
  ring: string;
}

/** Focus the element by keyboard and report what its ring actually paints against its own background. */
async function readRing(target: Locator): Promise<RingReading> {
  return target.evaluate(
    (el: HTMLElement, contrastSrc) => {
      // :focus-visible needs keyboard modality — a bare .focus() after a click would not match.
      el.focus();
      const cs = getComputedStyle(el);
      const shadow = cs.boxShadow;
      const resolve = (c: string) => {
        const probe = document.createElement('div');
        probe.style.color = c;
        document.body.appendChild(probe);
        const out = getComputedStyle(probe).color;
        probe.remove();
        return out;
      };
      let bg = cs.backgroundColor;
      if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = getComputedStyle(document.body).backgroundColor;
      const ring = resolve(cs.getPropertyValue('--tw-ring-color').trim());
      const contrast = (eval(contrastSrc) as (a: string, b: string) => number)(ring, bg);
      return { inset: shadow.includes('inset'), contrast, bg, ring };
    },
    CONTRAST_FN,
  );
}

test.describe('focus ring', () => {
  test('draws inside the control so a clipping ancestor cannot cut it', async ({ page }) => {
    await openApp(page);
    // Tab puts the browser in keyboard modality, which is what arms :focus-visible for the reads below.
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, shadow: cs.boxShadow, inset: cs.getPropertyValue('--tw-ring-inset').trim() };
    });
    expect(active.inset).toBe('inset');
    expect(active.shadow).toContain('inset');
  });

  test('stays legible on a filled control in both themes', async ({ page }, testInfo) => {
    // Ring color is a theme concern, identical at every viewport; mobile only differs in hiding this
    // particular button behind the Menu, which would test the layout rather than the color.
    test.skip(testInfo.project.name !== 'desktop', 'mobile keeps the primary action behind the Menu');
    for (const theme of ['light', 'dark'] as const) {
      await openApp(page, { FORMAMORPH_theme: theme });
      await page.keyboard.press('Tab');
      await page.evaluate((t) => {
        document.documentElement.classList.toggle('dark', t === 'dark');
      }, theme);

      // "New World" is a default-variant (filled primary) Button on the Main Menu.
      const button = page.getByRole('button', { name: 'New World' });
      await button.waitFor();
      const reading = await readRing(button);

      expect(reading.inset, `${theme}: ring must stay inset`).toBe(true);
      expect(
        reading.contrast,
        `${theme}: ring ${reading.ring} on fill ${reading.bg} is ${reading.contrast.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  test('a control flush against a scroll edge keeps its whole ring', async ({ page }) => {
    await openApp(page);
    await gotoDev(page, 'mainMenu', { modal: 'settings' });
    await page.keyboard.press('Tab');
    // An inset ring is painted within the border box, so a zero gap to the clip edge is harmless —
    // assert both halves: something really is flush, and its ring is still inset.
    const result = await page.evaluate(() => {
      const out: { flush: number; allInset: boolean; offenders: string[] } = { flush: 0, allInset: true, offenders: [] };
      for (const vp of document.querySelectorAll('[data-radix-scroll-area-viewport]')) {
        const v = vp.getBoundingClientRect();
        for (const el of vp.querySelectorAll<HTMLElement>('button, input, textarea, [role="combobox"]')) {
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          if (r.left - v.left < 4 || r.top - v.top < 4) {
            el.focus();
            // A control that takes no focus (disabled) draws no focus ring, so it has none to clip.
            if (document.activeElement !== el) continue;
            out.flush++;
            if (getComputedStyle(el).getPropertyValue('--tw-ring-inset').trim() !== 'inset') {
              out.allInset = false;
              // Named, so a failure points at the control rather than only saying one exists.
              out.offenders.push(`${el.tagName.toLowerCase()}[${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)}]`);
            }
          }
        }
      }
      return out;
    });
    expect(result.allInset, result.offenders.join('\n')).toBe(true);
  });
});
