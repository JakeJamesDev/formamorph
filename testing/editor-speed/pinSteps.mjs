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
    const t0 = Date.now();
    const select = async () => {
      await row.click();
      await ready().waitFor({ timeout: process.env.EDITOR_SPEED_PROFILE ? 60_000 : 180_000 });
    };
    await (process.env.EDITOR_SPEED_PROFILE ? profiled(cdp, `${label} open`, select) : select());
    const openMs = Date.now() - t0;
    await settle(page, 1500);
    return { openMs, settledMs: Date.now() - t0 };
  };

  /** Type into the open record's Name field and read input-to-paint latency. */
  const typeName = async (page) => {
    const field = page.getByRole('textbox', { name: 'Name', exact: true }).last();
    await field.click();
    await page.keyboard.press('End');
    await settle(page);
    await page.evaluate(() => { window.__bench.events = []; });
    const t0 = Date.now();
    await page.keyboard.type(TEXT, { delay: 120 });
    const typedMs = Date.now() - t0;
    await settle(page, 1500);
    if (!(await field.inputValue()).includes('quick brown fox')) throw new Error('typed text did not land in Name');
    const lat = await page.evaluate(() => window.__bench.events.filter((e) => /key|input|beforeinput/.test(e.name)).map((e) => e.duration));
    return { keys: TEXT.length, typedMs, latP50: pct(lat, 50), latP95: pct(lat, 95), latMax: pct(lat, 100) };
  };

  const domNodes = (page) => page.evaluate(() => document.getElementsByTagName('*').length);

  /** Open a pin source's Pins tab, then type into its Name on Details. */
  const pinSource = (tab, label) => async ({ page, cdp }) => traced(page, cdp, async () => {
    const opened = await openRow(page, cdp, tab, label, () => page.getByRole('tab', { name: 'Pins' }));
    const pinsTab = page.getByRole('tab', { name: 'Pins' });
    const t0 = Date.now();
    const showPins = async () => {
      await pinsTab.click();
      await page.getByRole('button', { name: 'Remove Pin' }).first().waitFor({ timeout: process.env.EDITOR_SPEED_PROFILE ? 60_000 : 180_000 });
    };
    await (process.env.EDITOR_SPEED_PROFILE ? profiled(cdp, `${label} Pins tab`, showPins) : showPins());
    const pinsTabMs = Date.now() - t0;
    await settle(page, 1500);
    const dom = await domNodes(page);
    const pinRows = await page.getByRole('button', { name: 'Remove Pin' }).count();
    await page.getByRole('tab', { name: 'Details' }).click();
    await settle(page);
    return { ...opened, pinsTabMs, pinRows, domNodes: dom, ...(await typeName(page)) };
  });

  return {
    async pinTarget({ page, cdp }) {
      return traced(page, cdp, async () => {
        const opened = await openRow(page, cdp, 'Placeholders', 'Mood', () => page.getByRole('button', { name: 'Add Pin' }));
        const dom = await domNodes(page);
        return { ...opened, domNodes: dom, ...(await typeName(page)) };
      });
    },
    pinSourceTrait: pinSource('Traits', 'Pin Heavy Trait'),
    pinSourceLocation: pinSource('Locations', 'The Hub'),
  };
}
