import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/**
 * The Values tab header as a pager, and the line that marks the active value. Screen positions, computed
 * paint and real keystrokes are the claims here; which value is active in the abstract is the unit suite's.
 */

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
  listWorlds(): Promise<unknown[]>;
}

const values = (id: string, texts: string[]) => texts.map((text, i) => ({ id: `${id}-v${i}`, text }));
const chip = (id: string, placement: string) => `{{ph:${id}:world:${placement}}}`;

// Ten values whose lengths differ, so a step changes the verbose label's width and crosses 9/10 → 10/10.
const TEN = values('ph-ten', [
  'one', 'a second value a good deal longer than the first', 'three', 'four',
  'a fifth value, longer again, with commas in it', 'six', 'seven',
  'an eighth value that runs on for a while', 'nine', 'ten',
]);

const PLACEHOLDERS = [
  { id: 'ph-ten', name: 'Ten', values: TEN },
  { id: 'ph-two', name: 'Two', values: values('ph-two', ['Al', 'Bo']) },
  // A second placeholder, so the pair are two values rather than one value and its mirror.
  { id: 'ph-duo', name: 'Duo', values: values('ph-duo', ['Cy', 'Di']) },
  { id: 'ph-long', name: 'Long', values: values('ph-long', [
    'she walked for three days along the river and slept under the bridge each night until the rain stopped',
    'he rode for four nights along the coast and camped in the dunes each dawn until the wind turned north',
  ]) },
];

const ENTITIES: Record<string, string> = {
  // The chip leads the text, so every value's first line starts at the same place and the header is seated
  // identically at every step. With words in front, a narrow editor breaks before some values and not
  // others, which moves the whole header — the value's own wrap, not the pager's doing.
  Pager: `${chip('ph-ten', 't1')} happened, they say.`,
  // Enough text to scroll a short field, with the value late in it.
  Scroll: `${'Filler text that goes on and on. '.repeat(20)}Then ${chip('ph-two', 'w1')} arrived.`,
  Pair: `First ${chip('ph-two', 'a1')} then ${chip('ph-duo', 'b1')}.`,
  // Two World chips of one placeholder: the second is a mirror, which takes no caret of its own.
  Mirror: `First ${chip('ph-two', 'm1')} then ${chip('ph-two', 'm2')} at the end of a fairly long sentence.`,
  // One long value, so a narrow editor makes it wrap and the outline traces more than one line.
  Wrap: `${chip('ph-long', 'w1')}.`,
};

const WORLD = {
  id: 'e2e-open-value-header',
  worldOverview: { name: 'E2E Open Value Header', description: '', author: '' },
  locations: [],
  stats: [],
  entities: Object.entries(ENTITIES).map(([name, aiDescription], i) => ({ id: `ent-${i}`, name, type: 'Person', aiDescription })),
  traits: [],
  statUpdates: [],
  placeholders: PLACEHOLDERS,
};

const FIELD = '[data-find-field="AI-Facing Description"]';

/** Open one entity's AI-facing description on the Values tab and return its editor root. */
async function openValues(page: Page, entity: string, theme: 'light' | 'dark' = 'light'): Promise<Locator> {
  // A live event's poster is modal over the menu and swallows the clicks below.
  await page.route(
    (url) => url.pathname.includes('/events/') && !url.pathname.startsWith('/src/'),
    (route) => route.fulfill({ json: [] }),
  );
  await openApp(page, { FORMAMORPH_theme: theme });
  await page.evaluate((t) => { document.documentElement.classList.toggle('dark', t === 'dark'); }, theme);
  await expect.poll(() => page.evaluate(async () => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    return (await dev.listWorlds()).length;
  }), { timeout: 20_000 }).toBeGreaterThan(5);
  await page.evaluate(async (world) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    await dev.editWorld(await dev.putWorld(world));
  }, WORLD);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'entities', subtab: 'descriptions' });
  await page.getByText(entity, { exact: true }).first().click();
  await page.getByRole('tablist', { name: 'Entity Fields' }).waitFor();
  const field = page.locator(FIELD);
  await field.getByRole('tab', { name: 'Values' }).click();
  const root = field.locator('[contenteditable="true"]').first();
  await expect(root.locator('[data-open-value] path[d]').first()).toBeAttached();
  return root;
}

interface Rect { left: number; top: number; right: number; bottom: number }
interface HeaderReading {
  prev: Rect;
  next: Rect;
  counter: string;
  /** The verbose label, when the header shows it rather than keeping it clipped for a reader and a pointer. */
  shownLabel: string | null;
  labelLeft: number | null;
  name: Rect;
  stroke: string;
  strokeWidth: string;
  fill: string;
  active: boolean;
  pieces: number;
  lines: number;
  text: string;
}

/** Reads one open value's header controls, its shape's paint, and its text. */
function reading(root: Locator, nth = 0): Promise<HeaderReading> {
  return root.evaluate((el, i) => {
    const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const chipEl = [...el.querySelectorAll<HTMLElement>('[data-open-value]')][i];
    const header = chipEl.querySelector<HTMLElement>(':scope > [data-open-value-header]')!;
    const buttons = [...header.querySelectorAll('button')];
    const label = header.querySelector<HTMLElement>('[data-open-value-label]');
    const path = chipEl.querySelector<SVGPathElement>(':scope > [data-open-value-shape] path')!;
    const style = getComputedStyle(path);
    return {
      prev: box(buttons[0].getBoundingClientRect()),
      next: box(buttons[buttons.length - 1].getBoundingClientRect()),
      counter: header.querySelector('.sr-only')?.textContent ?? '',
      shownLabel: label && label.getBoundingClientRect().width > 4 ? label.textContent : null,
      labelLeft: label ? label.getBoundingClientRect().left : null,
      name: box(header.getClientRects()[0]),
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      fill: style.fill,
      active: chipEl.hasAttribute('data-active'),
      // One `M` per piece of the traced shape: a wrap that joins stays one.
      pieces: (path.getAttribute('d')?.match(/M/g) ?? []).length,
      // Rects merged into one row per visual line, the way the outline itself groups them.
      lines: [...chipEl.querySelector('[data-lexical-slot]')!.getClientRects()]
        .filter((r) => r.width > 0)
        .reduce<{ top: number; bottom: number }[]>((rows, r) => {
          const last = rows[rows.length - 1];
          if (last && r.top < last.bottom && r.bottom > last.top) last.bottom = Math.max(last.bottom, r.bottom);
          else rows.push({ top: r.top, bottom: r.bottom });
          return rows;
        }, []).length,
      text: chipEl.querySelector('[data-open-value-text]')?.textContent ?? '',
    };
  }, nth);
}

/** Two reads alike, so the layout pass (which runs off a resize observer) has finished moving things. */
async function settle(page: Page, root: Locator, nth = 0): Promise<HeaderReading> {
  let last = await reading(root, nth);
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(50);
    const next = await reading(root, nth);
    if (JSON.stringify(next) === JSON.stringify(last)) return next;
    last = next;
  }
  throw new Error('the open value header never settled');
}

const stepNext = (root: Locator, nth = 0) =>
  root.locator('[data-open-value]').nth(nth).getByRole('button', { name: 'Next Value' }).click();
/** Presses the header on its name, which is the one part of it that is never a chevron. */
const pressHeader = (root: Locator, nth = 0) =>
  root.locator('[data-open-value]').nth(nth).locator('[data-open-value-header]').click({ position: { x: 4, y: 6 } });

const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;

test('both chevrons hold their place through every step, including 9/10 to 10/10', async ({ page }, testInfo) => {
  // The roll that opens the field is the world's, so the walk starts wherever it landed and wraps once.
  const root = await openValues(page, 'Pager');
  const first = await settle(page, root);
  // A narrow field gains and loses its own scrollbar as a value's height changes, which slides every header
  // a few pixels. That is the field moving, not the pager, so the screen positions are read on desktop.
  const onScreen = testInfo.project.name === 'desktop';
  const seen: string[] = [first.counter];
  for (let i = 0; i < 10; i++) {
    await stepNext(root);
    const now = await settle(page, root);
    seen.push(now.counter);
    for (const side of ['prev', 'next'] as const) {
      expect(near(now[side].left - now.name.left, first[side].left - first.name.left),
        `the ${side} chevron moved inside the header at ${now.counter}`).toBe(true);
      if (onScreen) {
        expect(near(now[side].left, first[side].left), `the ${side} chevron moved at ${now.counter}`).toBe(true);
      }
    }
  }
  // A full lap, so the step from the widest counter to the narrowest is always among the ten measured.
  expect(new Set(seen).size).toBe(10);
  expect(seen).toContain('Value 9 of 10');
  expect(seen).toContain('Value 10 of 10');
  expect(seen[10]).toBe(seen[0]);
});

test('a header going from compact to active moves nothing left of the verbose label', async ({ page }) => {
  const root = await openValues(page, 'Pager');
  const compact = await settle(page, root);
  expect(compact.shownLabel).toBeNull();

  await pressHeader(root);
  const active = await settle(page, root);
  expect(active.shownLabel).toMatch(/^ · Value \d+$/);
  // Measured from the header's own left edge: a narrow field's scrollbar slides every header a few pixels
  // as the active form grows the value's height, which is the field moving rather than the header's content.
  for (const side of ['prev', 'next'] as const) {
    expect(near(active[side].left - active.name.left, compact[side].left - compact.name.left),
      `the ${side} chevron moved inside the header`).toBe(true);
  }
  // Only the right edge grew, to make room for the label.
  expect(active.name.right - active.name.left).toBeGreaterThan(compact.name.right - compact.name.left);
});

test('a header press lands real keystrokes in that value', async ({ page }) => {
  const root = await openValues(page, 'Pair');
  const before = await settle(page, root, 1);
  const untouched = (await reading(root, 0)).text;

  await pressHeader(root, 1);
  await page.keyboard.type('!');
  expect((await settle(page, root, 1)).text).toBe(`${before.text}!`);
  expect((await reading(root, 0)).text).toBe(untouched);
});

test('a step then a keystroke types into the stepped value', async ({ page }) => {
  const root = await openValues(page, 'Pair');
  const before = await settle(page, root, 0);
  await stepNext(root, 0);
  const stepped = (await settle(page, root, 0)).text;
  expect(stepped).not.toBe(before.text);

  await page.keyboard.type('!');
  expect((await settle(page, root, 0)).text).toBe(`${stepped}!`);
});

test('a header press leaves the field scrolled where it was', async ({ page }) => {
  const root = await openValues(page, 'Scroll');
  await settle(page, root);
  const scroller = root.locator('xpath=ancestor-or-self::*[1]');
  const before = await root.evaluate((el) => {
    el.scrollTop = 24;
    return el.scrollTop;
  });
  await pressHeader(root);
  await settle(page, root);
  expect(await root.evaluate((el) => el.scrollTop)).toBe(before);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(before);
});

test('a press in the field text ends the active mark even where it moves no caret', async ({ page }) => {
  const root = await openValues(page, 'Mirror');
  await settle(page, root);
  // The end of the sentence, past both chips: a click here twice selects the same offset both times, so the
  // second one changes no selection and only the press itself says the author left the value.
  const spot = await root.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.right - 8, y: r.top + 12 };
  });
  await page.mouse.click(spot.x, spot.y);
  // The second copy is the mirror, which takes no caret, so the press below moves nothing.
  await pressHeader(root, 1);
  expect((await settle(page, root, 1)).active).toBe(true);

  await page.mouse.click(spot.x, spot.y);
  await expect.poll(() => reading(root, 1).then((r) => r.active)).toBe(false);
});

test('a wrapped active value keeps one contiguous outline', async ({ page }) => {
  const root = await openValues(page, 'Wrap');
  await root.evaluate((el) => { el.style.width = '260px'; });
  const idle = await settle(page, root);
  expect(idle.lines, 'the value must wrap for this to mean anything').toBeGreaterThan(1);
  expect(idle.pieces).toBe(1);

  await pressHeader(root);
  const active = await settle(page, root);
  expect(active.active).toBe(true);
  expect(active.stroke).not.toBe('none');
  // The quieter look loses none of the shape's meaning: still one line around every row of the value. The
  // row count is read again rather than carried over, since a tap on mobile opens the field full screen.
  expect(active.lines, 'the active value must still wrap').toBeGreaterThan(1);
  expect(active.pieces).toBe(1);
});

for (const theme of ['light', 'dark'] as const) {
  test(`only the active value carries a line, in ${theme}`, async ({ page }) => {
    const root = await openValues(page, 'Pair', theme);
    const idle = await settle(page, root);
    expect(idle.stroke, `${theme}: an inactive value must draw no line`).toBe('none');
    expect(idle.fill).not.toBe('none');

    await pressHeader(root);
    const active = await settle(page, root);
    expect(active.stroke, `${theme}: the active value must draw a line`).not.toBe('none');
    expect(active.strokeWidth).toBe('1px');
    // Activating adds a line and nothing else: the color under the text does not shift.
    expect(active.fill).toBe(idle.fill);
    // The other value stays quiet.
    expect((await reading(root, 1)).stroke).toBe('none');
  });
}
