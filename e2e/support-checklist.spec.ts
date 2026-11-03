import { expect, test } from '@playwright/test';
import { gotoDev, openApp } from './app';

test.describe('The support checklist layout', () => {
  // The first load on a cold dev server seeds the default worlds before the menu settles.
  test.setTimeout(120_000);

  for (const width of [1280, 375]) {
    test(`at ${width} the steps stay in order and every action is reachable`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 800 });
      await openApp(page);
      await page.getByText('Loaded default worlds').waitFor({ state: 'visible', timeout: 60_000 });

      for (const sample of ['start', 'visited', 'noPledge', 'linked', 'finished']) {
        await gotoDev(page, 'mainMenu', { modal: 'road', tab: 'checklist', subtab: sample });
        await expect(page.getByRole('heading', { name: 'Get Formamorph AI' })).toBeVisible();
        await page.waitForTimeout(1200);

        // Rows hold one fixed order whatever is done, and none overlaps the next.
        const boxes = await page.locator('[data-step]').evaluateAll((rows) => rows.map((row) => {
          const { y, height } = row.getBoundingClientRect();
          return { step: row.getAttribute('data-step'), y, height };
        }));
        expect(boxes.map((box) => box.step)).toEqual(['signIn', 'pledge', 'link', 'switch']);
        for (let i = 1; i < boxes.length; i += 1) expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].height);

        const stage = (await page.locator('[data-road-stage]').boundingBox())!;
        const title = (await page.getByRole('heading', { name: 'Get Formamorph AI' }).boundingBox())!;
        expect(title.y + title.height).toBeLessThanOrEqual(stage.y);
        expect(stage.y + stage.height).toBeLessThanOrEqual(boxes[0].y);

        const footer = page.locator('[role="dialog"] button').filter({ hasText: /^(Finish Later|Sign In|Open Patreon|Link Patreon|Switch to Formamorph AI|Back to Story)$/ });
        for (const button of await footer.all()) {
          if (!(await button.isVisible())) continue;
          const box = (await button.boundingBox())!;
          expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

        // Each sample's frame; `linked` is the mid-checklist one the ticket asks for.
        if (process.env.CHECKLIST_FRAMES) {
          const name = sample === 'linked' ? `checklist-${width}` : `checklist-${width}-${sample}`;
          await page.screenshot({ path: `.scratch/frames/${name}.png`, style: '[aria-label^="Notifications"] { display: none !important; }' });
        }
      }
    });
  }
});
