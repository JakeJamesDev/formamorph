import { test, expect, type Locator, type Page } from '@playwright/test';
import { openApp } from './app';

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
  goto(view: string, opts: Record<string, string | boolean>): void;
}

// A 1×1 PNG, so the entity's gallery has a frame to hang a rule on.
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const trait = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, statChanges: [], ...extra });
// Long names, so a row of four Conditions wraps in the trait panel.
const LONG = ['The Oath of the Burning Dawn', 'The Covenant of Quiet Waters', 'The Pact of the Hollow Crown', 'The Vow of the Last Lantern'];
const many = Array.from({ length: 24 }, (_, i) => trait(`t${i}`, `Trait ${String(i).padStart(2, '0')}`));

const WORLD = {
  id: 'e2e-requires-sentences',
  worldOverview: { name: 'E2E Requires', description: '', author: '' },
  locations: [{ id: 'hall', name: 'Hall' }],
  stats: [],
  statUpdates: [],
  items: [{ id: 'lamp', name: 'Lantern' }],
  entities: [
    {
      id: 'mira', name: 'Mira', playerDescription: '', aiDescription: '', locations: ['hall'],
      traits: [trait('squire', 'Squire')],
      images: [{ data: PIXEL, requires: [{ all: [{ kind: 'trait', id: 't0' }] }] }],
    },
    {
      id: 'albus', name: 'Albus', persona: true, playerDescription: '', aiDescription: '', locations: ['hall'],
      traits: [trait('rally', 'Rally', { requires: [{ all: [{ kind: 'trait', id: 'squire' }] }] })],
    },
  ],
  traits: [
    trait('dusk', 'Dusk', {
      requires: [{ all: [
        { kind: 'item', id: 'lamp', status: 'owned', owner: { kind: 'entity', id: 'mira', name: 'Mira' }, state: 'lit', identity: 'identified' },
        { kind: 'time', dayparts: ['morning', 'evening'] },
      ] }],
    }),
    ...LONG.map((name, i) => trait(`long${i}`, name)),
    ...many,
    trait('smite', 'Smite', {
      requires: [
        { all: LONG.map((_, i) => ({ kind: 'trait', id: `long${i}` })) },
        { all: [{ kind: 'trait', id: 'squire' }, { kind: 'playingAs', id: 'albus' }] },
      ],
    }),
  ],
};

async function openWorld(page: Page, tab: string) {
  await openApp(page);
  await page.evaluate(async ([world, t]) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    const id = await dev.putWorld(world);
    await dev.editWorld(id);
    dev.goto('mainMenu', { modal: 'worldEditor', tab: t as string });
  }, [WORLD, tab] as const);
}

async function openTrait(page: Page, name: string) {
  await openWorld(page, 'traits');
  await page.getByRole('dialog').getByText(name, { exact: true }).first().click();
  await page.getByRole('tab', { name: 'Availability' }).click();
  await page.locator('[data-requirement-row]').first().waitFor();
}

const boxes = async (locator: Locator) => {
  const out: { x: number; y: number; width: number; height: number }[] = [];
  for (const el of await locator.all()) {
    const box = await el.boundingBox();
    if (box) out.push(box);
  }
  return out;
};

test.describe('Requires sentences', () => {
  test('a Condition that does not fit starts the next line, its "and" left on the line above', async ({ page }) => {
    await openTrait(page, 'Smite');
    const row = page.locator('[data-requirement-row]').first();
    const clauses = row.locator('[data-clause]');
    const rects = await boxes(clauses);
    expect(rects).toHaveLength(4);
    const lineHeight = Math.min(...rects.map((r) => r.height));
    // Each box stays one piece: no box is taller than one line.
    for (const r of rects) expect(r.height).toBeLessThan(lineHeight * 1.5);
    const wrapped = rects.findIndex((r, i) => i > 0 && r.y > rects[i - 1].y + lineHeight / 2);
    expect(wrapped).toBeGreaterThan(0);
    // The wrapped box starts its line at the row's left edge, and the box above ends in "and".
    const paragraph = await row.locator('p').boundingBox();
    expect(Math.abs(rects[wrapped].x - paragraph!.x)).toBeLessThan(2);
    expect((await clauses.nth(wrapped - 1).textContent())?.trim()).toMatch(/ and$/);
    expect((await clauses.nth(wrapped).textContent())?.trim()).not.toMatch(/^and/);
  });

  test('a selection never moves or resizes the choices of the owner list or the target list', async ({ page }) => {
    test.setTimeout(180_000);
    // Rally sits on Albus and requires Mira's Squire, so every owner choice keeps a subject.
    await openTrait(page, 'Rally');
    const row = page.locator('[data-requirement-row]').first();

    const measure = async (token: RegExp) => {
      await row.getByRole('button', { name: token }).click();
      const options = page.getByRole('option');
      await options.first().waitFor();
      // The popover follows its token, which moves when the words before it change; the choices are read
      // against the list's own corner. The popover zooms in on open, so read once two reads agree.
      const list = page.getByRole('listbox');
      const read = async () => {
        const origin = (await list.boundingBox())!;
        return [{ width: origin.width, height: origin.height }, ...(await boxes(options)).map((r) => ({ ...r, x: r.x - origin.x, y: r.y - origin.y }))];
      };
      let rects = await read();
      for (let tries = 0; tries < 40; tries++) {
        await page.waitForTimeout(50);
        const next = await read();
        if (JSON.stringify(next) === JSON.stringify(rects)) break;
        rects = next;
      }
      return { options, rects, names: await options.allTextContents() };
    };

    for (const token of [/^Owner:/, /^Target:/]) {
      const first = await measure(token);
      await page.keyboard.press('Escape');
      for (let i = 0; i < first.names.length; i++) {
        const now = await measure(token);
        expect(now.rects).toEqual(first.rects);
        const option = now.options.nth(i);
        if (await option.getAttribute('aria-disabled') === 'true') {
          await page.keyboard.press('Escape');
          continue;
        }
        await option.click();
        await expect(page.getByRole('listbox')).toHaveCount(0);
      }
    }
  });

  test('a token popover inside the image rule popover scrolls with the wheel', async ({ page }) => {
    await openWorld(page, 'entities');
    await page.getByRole('dialog').getByText('Mira', { exact: true }).first().click();
    await page.locator('[data-image-rule-button]').first().click();
    await page.getByRole('button', { name: /^Target: Trait 00/ }).click();
    const list = page.locator('[cmdk-list]').last();
    await list.waitFor();
    const before = await list.evaluate((el) => el.scrollTop);
    const box = await list.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
  });
  test('a toggle in the time set popover never moves or resizes the other toggles', async ({ page }) => {
    await openTrait(page, 'Dusk');
    await page.getByRole('button', { name: /^Time of day:/ }).click();
    const toggles = page.getByRole('toolbar', { name: 'Time of day' }).getByRole('button');
    await expect(toggles).toHaveCount(6);
    const read = async () => (await boxes(toggles)).map((r) => ({ ...r, y: Math.round(r.y), x: Math.round(r.x) }));
    // The popover zooms in on open, so read once two reads agree.
    let before = await read();
    for (let tries = 0; tries < 40; tries++) {
      await page.waitForTimeout(50);
      const next = await read();
      if (JSON.stringify(next) === JSON.stringify(before)) break;
      before = next;
    }
    for (let i = 0; i < 6; i++) {
      await toggles.nth(i).click();
      // The sentence behind the popover changes width, so the popover may follow its token; compare the toggles to each other.
      const now = await read();
      const origin = (b: typeof now) => b.map((r) => ({ width: r.width, height: r.height, dx: r.x - b[0].x, dy: r.y - b[0].y }));
      expect(origin(now)).toEqual(origin(before));
    }
  });
});
