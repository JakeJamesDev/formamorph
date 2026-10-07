// Pin steps for the editor-speed harness. They need the pin world: `genLargeWorld.mjs --pins 1`.
// `pinTarget` opens "Mood", the placeholder pinned from everywhere; `pinSource*` open a trait and a location
// that each pin many placeholders. Each step times the open, counts what it drew, and types into Name.

const TEXT = ' the quick brown fox jumps';
const ROW = 'div.cursor-pointer:has(span.cursor-grab)';

export function pinSteps({ settle, traced, pct, profiled }) {
  /** Select the row named `label` in tab `tab`, timing until `ready` shows. */
  const openRow = async (page, cdp, tab, label, ready) => {
    await page.getByRole('tab', { name: tab, exact: true }).first().click();
    await settle(page);
    const row = page.locator(`[role="tabpanel"] ${ROW}`).filter({ hasText: new RegExp(`^${label}$`) }).first();
    await row.scrollIntoViewIfNeeded({ timeout: 60_000 });
    await page.evaluate(() => {
      window.__openTasks = [];
      new PerformanceObserver((list) => window.__openTasks.push(...list.getEntries().map((e) => e.duration))).observe({ type: 'longtask' });
    });
    const t0 = Date.now();
    const select = async () => {
      // A heavy record can hold the main thread past the default click timeout.
      await row.click({ timeout: 180_000 });
      await ready().waitFor({ timeout: process.env.EDITOR_SPEED_PROFILE ? 60_000 : 180_000 });
    };
    await (process.env.EDITOR_SPEED_PROFILE ? profiled(cdp, `${label} open`, select) : select());
    const openMs = Date.now() - t0;
    await settle(page, 1500);
    const openMaxBlockMs = Math.round(await page.evaluate(() => Math.max(0, ...window.__openTasks)));
    return { openMs, settledMs: Date.now() - t0, openMaxBlockMs };
  };

  /** Type into the open record's Name field and read input-to-paint latency. */
  const typeName = async (page) => {
    // CSS, not a role query: on a record with hundreds of pins, naming every element outlasts the timeout.
    const field = page.locator('label:text-is("Name") + input, [aria-label="Name"]').last();
    await field.click();
    await page.keyboard.press('End');
    await settle(page);
    await page.evaluate(() => { window.__bench.events = []; });
    const t0 = Date.now();
    await page.keyboard.type(TEXT, { delay: 120 });
    const typedMs = Date.now() - t0;
    await settle(page, 1500);
    if (!(await field.evaluate((el) => (el.value ?? el.textContent ?? '').includes('quick brown fox')))) throw new Error('typed text did not land in Name');
    const lat = await page.evaluate(() => window.__bench.events.filter((e) => /key|input|beforeinput/.test(e.name)).map((e) => e.duration));
    return { keys: TEXT.length, typedMs, latP50: pct(lat, 50), latP95: pct(lat, 95), latMax: pct(lat, 100) };
  };

  const domNodes = (page) => page.evaluate(() => document.getElementsByTagName('*').length);

  /** Open a pin source's Pins tab, then type into its Name on Details. */
  const pinSource = (tab, label) => async ({ page, cdp }) => traced(page, cdp, async () => {
    const opened = await openRow(page, cdp, tab, label, () => page.getByRole('tab', { name: 'Pins' }));
    const pinsTab = page.getByRole('tab', { name: 'Pins' });
    // The longest main-thread task while the Pins tab opens, apart from the typing that follows.
    await page.evaluate(() => {
      window.__pinTasks = [];
      new PerformanceObserver((list) => window.__pinTasks.push(...list.getEntries().map((e) => e.duration))).observe({ type: 'longtask' });
    });
    const t0 = Date.now();
    const showPins = async () => {
      await pinsTab.click();
      // A CSS locator: a role query computes every button's accessible name, and with 200 rows that scan is
      // most of what the step would time.
      await page.locator('button[aria-label="Remove Pin"]').first().waitFor({ timeout: process.env.EDITOR_SPEED_PROFILE ? 60_000 : 180_000 });
    };
    await (process.env.EDITOR_SPEED_PROFILE ? profiled(cdp, `${label} Pins tab`, showPins) : showPins());
    const pinsTabMs = Date.now() - t0;
    await settle(page, 1500);
    const pinsTabMaxBlockMs = Math.round(await page.evaluate(() => Math.max(0, ...window.__pinTasks)));
    const dom = await domNodes(page);
    const pinRows = await page.locator('button[aria-label="Remove Pin"]').count();
    await page.getByRole('tab', { name: 'Details' }).click();
    await settle(page);
    return { ...opened, pinsTabMs, pinsTabMaxBlockMs, pinRows, domNodes: dom, ...(await typeName(page)) };
  });

  return {
    async pinTarget({ page, cdp }) {
      return traced(page, cdp, async () => {
        const opened = await openRow(page, cdp, 'Placeholders', 'Mood', () => page.locator('button:has-text("Add Pin")').first());
        const dom = await domNodes(page);
        // The open's numbers stand even when typing then times out.
        const typed = await typeName(page).catch((e) => ({ typeError: String(e.message ?? e).split('\n').slice(0, 3).join(' | ') }));
        return { ...opened, domNodes: dom, ...typed };
      });
    },
    pinSourceTrait: pinSource('Traits', 'Pin Heavy Trait'),
    pinSourceLocation: pinSource('Locations', 'The Hub'),
  };
}
