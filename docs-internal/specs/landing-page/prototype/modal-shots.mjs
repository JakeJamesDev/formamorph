// PROTOTYPE — tight element shots of the settings modal, both themes.
import { chromium } from '@playwright/test';
const BASE = 'http://localhost:5180';
const OUT = '.scratch/landing-page/prototype/shots';
const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#dev?modal=settings&tab=display`);
  await page.waitForTimeout(9000);
  for (let i = 0; i < 3; i++) {
    const b = page.getByRole('button', { name: 'Got It' }).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(300); }
  }
  const dlg = page.locator('[role="dialog"]').last();
  await dlg.screenshot({ path: `${OUT}/${scheme}/04-settings-modal.png` });
  console.log(scheme, 'modal shot');
  await ctx.close();
}
await browser.close();
