import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/**
 * The edge-to-edge window. Playwright's clicks skip the native layer, so drag areas and window buttons
 * are read from `WM_NCHITTEST`, which reports what Windows would do with a click at a screen point.
 */

const HT = { client: 1, caption: 2, minimize: 8, maximize: 9, close: 20 } as const;
const CONTROLS = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="combobox"], [role="switch"], [role="radio"]';

/** Stores one frame per Surface and theme in this folder, when set. */
const FRAMES_DIR = process.env.WINDOW_FRAMES_DIR;

type Box = { name: string; x: number; y: number; right: number; bottom: number };

/** Every control a player can see in the header line, with its box. */
const headerControls = (page: Page): Promise<Box[]> =>
  page.evaluate((selector) => {
    const seen = (el: Element, r: DOMRect) => {
      if (r.width < 2 || r.height < 2) return false;
      // A disabled control takes no pointer events, so the page's own hit test looks through it.
      if (el.matches(':disabled')) return el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && !el.closest('[aria-hidden="true"]');
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!hit && (el === hit || el.contains(hit));
    };
    return [...document.querySelectorAll(selector)].flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (r.y >= 56 || !seen(el, r)) return [];
      const name = el.getAttribute('aria-label') || (el as HTMLElement).innerText?.slice(0, 30) || el.tagName;
      return [{ name, x: r.x, y: r.y, right: r.right, bottom: r.bottom }];
    });
  }, CONTROLS);

const buttonsWidth = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.width = 'var(--window-buttons-width)';
    document.body.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  });

/** The five Surfaces, each with the control its opening waits on and the line its top row centers on. */
const SURFACES: { name: string; frame?: string; line: number; lineStartsAt?: (page: Page) => Locator; open: (page: Page) => Promise<void>; ready: (page: Page) => Locator }[] = [
  {
    name: 'main menu',
    frame: 'window-menu',
    line: 28,
    open: (page) => gotoDev(page, 'mainMenu'),
    ready: (page) => page.locator('[data-fold-live="toggle"]'),
  },
  {
    name: 'game',
    frame: 'window-game',
    line: 28,
    // The left and center panels rise past the line, so only the right column's header sits on it.
    lineStartsAt: (page) => page.getByRole('button', { name: 'Save Game' }),
    // The seeded endpoint never answers, so the play gate opens; a player would continue past it.
    open: async (page) => {
      await gotoDev(page, 'gameViewer');
      await page.getByRole('button', { name: 'Continue anyway' }).click();
    },
    ready: (page) => page.getByRole('button', { name: 'Hide UI' }).or(page.getByRole('button', { name: 'Show UI' })),
  },
  {
    name: 'World Editor',
    frame: 'window-editor',
    // Its bar has a 1px border above the row.
    line: 29,
    open: (page) => gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'overview' }),
    ready: (page) => page.getByRole('searchbox').or(page.getByPlaceholder('Search World')).first(),
  },
  {
    name: 'Community Creations',
    frame: 'window-community',
    line: 28,
    open: (page) => gotoDev(page, 'mainMenu', { modal: 'community' }),
    ready: (page) => page.getByRole('heading', { name: 'Community Creations' }),
  },
  {
    name: 'full screen editor',
    frame: 'window-shell',
    line: 28,
    open: (page) => gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas', fullscreen: true }),
    ready: (page) => page.getByRole('button', { name: 'Exit full screen' }),
  },
];

/** Lets the Surface settle: a dialog's exit or the header fold can move a control for a few frames. */
const settle = (page: Page) => page.waitForTimeout(400);

const expectOnLine = async (page: Page, line: number, lineStart?: Locator) => {
  const from = (await lineStart?.boundingBox())?.x ?? 0;
  const controls = (await headerControls(page)).filter((c) => c.x >= from);
  expect(controls.length).toBeGreaterThan(0);
  for (const c of controls) {
    expect(Math.abs((c.y + c.bottom) / 2 - line), `${c.name} centers within 1px of y=${line}`).toBeLessThanOrEqual(1);
  }
};

const showToast = (page: Page) =>
  page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('react-toastify') && n.includes('.js'));
    const { toast } = await import(/* @vite-ignore */ url as string);
    toast('Below the header', { position: 'top-right' });
  });

const expectToastBelowHeader = (page: Page) =>
  expect.poll(async () => (await page.locator('.Toastify__toast').first().boundingBox())?.y).toBeGreaterThanOrEqual(56);

const middle = (box: { x: number; width: number } | null): number => {
  if (!box) throw new Error('The element has no box');
  return box.x + box.width / 2;
};

/** The main menu's row of action buttons; the hidden measuring copies don't count. */
const actionRow = (page: Page) => page.locator('button:visible', { hasText: 'New World' }).first().locator('..');
const actionCenter = async (page: Page) => middle(await actionRow(page).boundingBox());
const windowCenter = (page: Page) => page.evaluate(() => window.innerWidth / 2);

const expectActionsCentered = async (page: Page) => {
  expect(Math.abs((await actionCenter(page)) - (await windowCenter(page)))).toBeLessThanOrEqual(1);
};

/** Holds at every width: the search stays on center while it's over its floor, and nothing in the bar overlaps. */
const expectEditorBarHolds = async (page: Page, width: number) => {
  const search = await page.getByRole('search').first().boundingBox();
  if (!search) throw new Error('The World Editor has no search');
  expect(search.width, `the search keeps its floor at ${width}`).toBeGreaterThanOrEqual(159.5);
  if (search.width > 160.5) expect(Math.abs(middle(search) - width / 2), `the search centers at ${width}`).toBeLessThanOrEqual(1);
  const title = await page.getByText('World Editor', { exact: true }).first().boundingBox();
  expect(search.x, `the search clears the title at ${width}`).toBeGreaterThanOrEqual((title?.x ?? 0) + (title?.width ?? 0));
  const right = search.x + search.width;
  // The search's own controls sit inside its box; any other control has to clear it.
  const overlapping = (await headerControls(page)).filter((c) => c.right > search.x + 1 && c.x < right - 1 && (c.x < search.x - 1 || c.right > right + 1));
  expect(overlapping.map((c) => c.name), `nothing overlaps the search at ${width}`).toEqual([]);
};

test.describe('web', () => {
  test.beforeEach(({ page: _page }, info) => test.skip(info.project.name !== 'desktop', 'One viewport is enough'));

  test('centers the main menu buttons wherever both sides have room', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openApp(page);
    await gotoDev(page, 'mainMenu');
    await settle(page);
    await expectActionsCentered(page);
    await page.setViewportSize({ width: 1920, height: 1000 });
    await settle(page);
    await expectActionsCentered(page);
  });

  test('moves the main menu buttons only as far as the tabs need', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openApp(page);
    await gotoDev(page, 'mainMenu');
    await settle(page);
    const tabs = await page.locator('[data-fold-left] > *').first().boundingBox();
    const row = await actionRow(page).boundingBox();
    if (!tabs || !row) throw new Error('The bar has no tabs or buttons');
    // The bar's gap, and no more: any further would be drift the tabs don't ask for.
    expect(Math.abs(row.x - (tabs.x + tabs.width) - 8)).toBeLessThanOrEqual(1);
    test.info().annotations.push({ type: 'offset at 1280', description: String((await actionCenter(page)) - 640) });
  });

  test('opens Load Game and Settings in one click at full width', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openApp(page);
    await gotoDev(page, 'mainMenu');
    await page.getByRole('button', { name: 'Load Game' }).click();
    await expect(page.getByRole('dialog', { name: 'Load Game' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  });

  test('folds into one right-side menu', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await openApp(page);
    await gotoDev(page, 'mainMenu');
    await settle(page);
    await expect(page.getByRole('button', { name: 'Load Game' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
    const more = page.getByRole('button', { name: 'More Actions' }).first();
    const toggle = await page.locator('[data-fold-live="toggle"]').boundingBox();
    expect((await more.boundingBox())?.x).toBeGreaterThan((toggle?.x ?? 0) + (toggle?.width ?? 0) - 1);
    await more.click();
    const menu = page.getByRole('dialog');
    for (const name of ['Community Creations', 'New World', 'Import World', 'Load Game', 'Settings']) {
      await expect(menu.getByRole('button', { name })).toBeVisible();
    }
    await menu.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  });

  test('folds into a left hamburger on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);
    await gotoDev(page, 'mainMenu');
    await settle(page);
    await expect(page.getByRole('button', { name: 'More Actions' })).toBeHidden();
    const hamburger = page.getByRole('button', { name: 'Menu' });
    expect((await hamburger.boundingBox())?.x).toBeLessThan(40);
    await hamburger.click();
    const menu = page.getByRole('dialog');
    for (const name of ['Community Creations', 'New World', 'Import World', 'Load Game', 'Settings']) {
      await expect(menu.getByRole('button', { name })).toBeVisible();
    }
  });

  test('never offers Exit Full Screen', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await openApp(page);
    await gotoDev(page, 'mainMenu');
    await settle(page);
    await page.getByRole('button', { name: 'More Actions' }).first().click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exit Full Screen' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoDev(page, 'gameViewer');
    await page.getByRole('button', { name: 'Continue anyway' }).click();
    await page.getByRole('button', { name: 'More Actions' }).click();
    await expect(page.getByRole('button', { name: 'Edit World' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exit Full Screen' })).toHaveCount(0);
  });

  test('opens Backup & Restore over the Settings Data tab', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openApp(page);
    await gotoDev(page, 'mainMenu', { modal: 'settings', tab: 'data' });
    await page.getByRole('button', { name: 'Open Backup & Restore' }).click();
    const backup = page.getByRole('dialog', { name: 'Backup & Restore' });
    await expect(backup).toBeVisible();
    await backup.getByRole('button', { name: 'Close' }).first().click();
    await expect(backup).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open Backup & Restore' })).toBeVisible();
  });

  for (const mode of ['simple', 'advanced']) {
    test(`keeps the World Editor search centered in ${mode} mode`, async ({ page }) => {
      await page.setViewportSize({ width: 1690, height: 900 });
      await openApp(page, { 'formamorph.worldEditorMode': mode });
      await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'overview' });
      await page.getByRole('search').first().waitFor();
      for (const width of [1690, 1920, 1440, 1280, 1100, 1000]) {
        await page.setViewportSize({ width, height: 900 });
        await settle(page);
        await expectEditorBarHolds(page, width);
      }
      await page.setViewportSize({ width: 1690, height: 900 });
      await settle(page);
      const search = await page.getByRole('search').first().boundingBox();
      expect(Math.abs(middle(search) - 845)).toBeLessThanOrEqual(1);
    });
  }

  test('frames', async ({ page }) => {
    test.skip(!FRAMES_DIR, 'Frames only on request');
    test.setTimeout(120_000);
    mkdirSync(FRAMES_DIR as string, { recursive: true });
    await openApp(page);
    await gotoDev(page, 'mainMenu');
    // The first load's toast would cover the corner these frames show.
    await page.getByText('Veilwood').first().waitFor();
    await expect(page.locator('.Toastify__toast')).toHaveCount(0, { timeout: 20_000 });
    const shots: { name: string; width: number; open: () => Promise<void> }[] = [
      { name: 'menu-full', width: 1600, open: () => gotoDev(page, 'mainMenu') },
      {
        name: 'menu-narrow',
        width: 900,
        open: async () => {
          await gotoDev(page, 'mainMenu');
          await settle(page);
          await page.getByRole('button', { name: 'More Actions' }).first().click();
        },
      },
      { name: 'settings-backup', width: 1280, open: () => gotoDev(page, 'mainMenu', { modal: 'settings', tab: 'data' }) },
      { name: 'settings-backup-open', width: 1280, open: () => gotoDev(page, 'mainMenu', { modal: 'backup' }) },
      { name: 'editor-search', width: 1690, open: () => gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'overview' }) },
    ];
    for (const shot of shots) {
      await page.setViewportSize({ width: shot.width, height: 900 });
      await gotoDev(page, 'mainMenu');
      await shot.open();
      await page.waitForTimeout(1500);
      for (const theme of ['dark', 'light']) {
        await page.evaluate((t) => {
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(t);
        }, theme);
        await settle(page);
        await page.screenshot({ path: join(FRAMES_DIR as string, `${shot.name}-${theme}.png`) });
      }
    }
  });

  test('takes the header line without the desktop flag', async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => document.documentElement.dataset.windowOverlay)).toBeUndefined();
    // The token itself: this Chromium defines no overlay, so a measured width would read 0 even if it used `env()`.
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--window-buttons-width').trim())).toBe('0px');
    await expect(page.locator('.window-drag-area')).toHaveCount(0);
    for (const surface of SURFACES) {
      await surface.open(page);
      await surface.ready(page).first().waitFor();
      await settle(page);
      await test.step(surface.name, () => expectOnLine(page, surface.line, surface.lineStartsAt?.(page)));
      if (surface.name === 'game') await expect(page.locator('[data-window-corner-gradient]')).toBeHidden();
    }
  });

  test('starts a top-right toast below the header', async ({ page }) => {
    await openApp(page);
    await showToast(page);
    await expectToastBelowHeader(page);
  });

  test('keeps the Avatar card and the tall dialogs where they were', async ({ page }) => {
    await openApp(page);
    await gotoDev(page, 'mainMenu', { modal: 'avatar' });
    const card = page.getByRole('heading', { name: 'Avatar Customization' }).locator('xpath=ancestor::*[contains(@class, "overflow-hidden")][1]');
    await card.waitFor();
    await settle(page);
    expect((await card.boundingBox())?.y).toBeLessThan(20);
    await page.goto('/');
    await page.waitForFunction(() => '__fmDev' in window);
    await page.setViewportSize({ width: 800, height: 600 });
    await gotoDev(page, 'mainMenu', { modal: 'settings' });
    const dialog = page.getByRole('dialog').first();
    await dialog.waitFor();
    await settle(page);
    // The room exists only under the desktop flag, so a web dialog keeps the height the flag would cap.
    const box = await dialog.boundingBox();
    expect(box?.y).toBeLessThan(56);
    expect(box?.height).toBeGreaterThan(600 - 2 * 56 + 8);
    if (FRAMES_DIR) {
      mkdirSync(FRAMES_DIR, { recursive: true });
      await page.setViewportSize({ width: 1280, height: 860 });
      for (const [name, opts] of [['web-avatar-1280', { modal: 'avatar' }], ['web-dialog-1280', { modal: 'settings' }]] as const) {
        await gotoDev(page, 'mainMenu', opts);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: join(FRAMES_DIR, `${name}.png`) });
      }
    }
  });
});

test.describe('mobile', () => {
  test.beforeEach(({ page: _page }, info) => test.skip(info.project.name !== 'mobile', 'Phone profile only'));

  test('keeps the bar and the corner button at the mobile positions', async ({ page }) => {
    await openApp(page);
    await gotoDev(page, 'mainMenu');
    await settle(page);
    const top = await page.evaluate(() => document.querySelector('[data-fold-window-buttons]')?.parentElement?.parentElement?.getBoundingClientRect().y);
    expect(top).toBe(16);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'locations', subtab: 'canvas', fullscreen: true });
    const exit = await page.getByRole('button', { name: 'Exit full screen' }).boundingBox();
    expect(exit?.y).toBe(2);
    expect(await buttonsWidth(page)).toBe(0);
  });

  test('frames', async ({ page }) => {
    test.skip(!FRAMES_DIR, 'Frames only on request');
    mkdirSync(FRAMES_DIR as string, { recursive: true });
    await openApp(page);
    for (const surface of SURFACES) {
      await surface.open(page);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(FRAMES_DIR as string, `${surface.frame}-375.png`) });
    }
  });
});

test.describe('the Windows desktop app', () => {
  test.skip(process.platform !== 'win32', 'The overlay only exists on Windows');
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async ({ baseURL }, info) => {
    test.skip(info.project.name !== 'desktop', 'Runs its own window');
    test.setTimeout(120_000);
    // A short path: a long profile path breaks CacheStorage on Windows.
    const profile = mkdtempSync(join(tmpdir(), 'fm-wc-'));
    app = await electron.launch({
      args: ['.', `--user-data-dir=${profile}`],
      env: { ...process.env, VITE_DEV_SERVER_URL: baseURL as string } as Record<string, string>,
    });
    page = await app.firstWindow();
    // The desktop build's first-run AI prompt, already answered: this spec opens no game that needs a model.
    await openApp(page, { 'vite-ui-theme': 'dark', FORMAMORPH_aiSetupSeen: 'true' }, { url: baseURL as string });
  });

  test.afterAll(async () => {
    await app?.close();
  });

  const setSize = async (width: number, height: number) => {
    await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), [width, height]);
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(width);
  };

  /** What Windows answers at each point of the page. */
  const hitTest = async (points: { x: number; y: number }[]): Promise<number[]> => {
    const { hwnd, screen } = await app.evaluate(({ BrowserWindow, screen: display }, pts) => {
      const win = BrowserWindow.getAllWindows()[0];
      const content = win.getContentBounds();
      // From the window's own rect: a DIP point past a monitor's edge converts at the next monitor's scale.
      const rect = display.dipToScreenRect(win, content);
      const scale = rect.width / content.width;
      return {
        hwnd: win.getNativeWindowHandle().readBigUInt64LE().toString(),
        screen: pts.map((p) => ({ x: rect.x + p.x * scale, y: rect.y + p.y * scale })),
      };
    }, points);
    // Per-monitor aware: Windows rescales the point in a message from a DPI-unaware sender.
    const script = `
      Add-Type -Namespace Fm -Name Native -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l); [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);'
      [void][Fm.Native]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
      foreach ($p in '${screen.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}'.Split(' ')) {
        $x, $y = $p.Split(',')
        $l = ([int]$y -shl 16) -bor ([int]$x -band 0xFFFF)
        [Fm.Native]::SendMessage([IntPtr]::new([long]${hwnd}), 0x84, [IntPtr]::Zero, [IntPtr]::new($l)).ToInt64()
      }`;
    const out = await new Promise<string>((resolve, reject) => {
      execFile('powershell.exe', ['-NoProfile', '-Command', script], (error, stdout) => (error ? reject(error) : resolve(stdout)));
    });
    return out.trim().split(/\s+/).map(Number);
  };

  /** Empty header points: a sweep along the top that lands on nothing a player can use. */
  const emptyHeaderPoints = async (): Promise<{ x: number; y: number }[]> =>
    page.evaluate((selector) => {
      const clear = window.innerWidth - 200;
      const disabled = [...document.querySelectorAll(':disabled')].filter((el) => !el.closest('[aria-hidden="true"]')).map((el) => el.getBoundingClientRect());
      const points: { x: number; y: number }[] = [];
      // Below the top resize border, which Windows keeps along the edge.
      for (let x = 16; x < clear; x += 48) {
        const hit = document.elementFromPoint(x, 12);
        // A focusable group, like the view toggle's pill, counts as its controls.
        const onDisabled = disabled.some((r) => x >= r.left && x <= r.right && r.top <= 12 && r.bottom >= 12);
        if (hit && !onDisabled && !hit.closest(`${selector}, [tabindex="0"]`)) points.push({ x, y: 12 });
      }
      return points;
    }, CONTROLS);

  test('runs without a title bar, from y=0', async () => {
    const contentTop = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win.getContentBounds().y - win.getBounds().y;
    });
    expect(contentTop).toBe(0);
    // A fresh window drags from its first paint, before any resize.
    await settle(page);
    const empty = await emptyHeaderPoints();
    expect(empty.length).toBeGreaterThan(0);
    expect(new Set(await hitTest(empty))).toEqual(new Set([HT.caption]));
    expect(await page.evaluate(() => document.documentElement.dataset.windowOverlay)).toBe('');
    const overlayHeight = await page.evaluate(() => (navigator as unknown as { windowControlsOverlay: { getTitlebarAreaRect(): DOMRect } }).windowControlsOverlay.getTitlebarAreaRect().height);
    expect(overlayHeight).toBe(56);
  });

  test('holds the content area to 800x600', async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(400, 300));
    await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([800, 600]);
    await setSize(1280, 800);
  });

  test('takes the theme foreground on the window buttons, and follows the theme', async () => {
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0] as unknown as { setTitleBarOverlay(o: { symbolColor: string }): void };
      const real = win.setTitleBarOverlay.bind(win);
      (globalThis as unknown as { symbols: string[] }).symbols = [];
      win.setTitleBarOverlay = (o) => { (globalThis as unknown as { symbols: string[] }).symbols.push(o.symbolColor); real(o); };
    });
    const symbols = () => app.evaluate(() => (globalThis as unknown as { symbols: string[] }).symbols);
    const foreground = () => page.evaluate(() => {
      const [r, g, b] = getComputedStyle(document.body).color.match(/\d+/g)!.map(Number);
      return `#${[r, g, b].map((p) => p.toString(16).padStart(2, '0')).join('')}`;
    });
    const flip = (from: string, to: string) => page.evaluate(([a, b]) => {
      document.documentElement.classList.remove(a);
      document.documentElement.classList.add(b);
    }, [from, to]);

    await flip('dark', 'light');
    const light = await foreground();
    await expect.poll(async () => (await symbols()).at(-1)).toBe(light);
    await flip('light', 'dark');
    const dark = await foreground();
    expect(dark).not.toBe(light);
    await expect.poll(async () => (await symbols()).at(-1)).toBe(dark);
  });

  for (const surface of SURFACES) {
    test(`${surface.name}: on the line, clear of the window buttons, and draggable around its controls`, async () => {
      await setSize(1280, 800);
      await surface.open(page);
      await surface.ready(page).first().waitFor();
      await settle(page);
      await expectOnLine(page, surface.line, surface.lineStartsAt?.(page));

      for (const width of [1280, 900]) {
        await setSize(width, 800);
        await settle(page);
        const wall = width - (await buttonsWidth(page));
        expect(wall).toBeLessThan(width);
        for (const c of await headerControls(page)) {
          expect(c.right, `${c.name} clears the window buttons at ${width}`).toBeLessThanOrEqual(wall);
        }
      }

      await setSize(1280, 800);
      await settle(page);
      const controls = await headerControls(page);
      const atControls = await hitTest(controls.map((c) => ({ x: (c.x + c.right) / 2, y: (c.y + c.bottom) / 2 })));
      controls.forEach((c, i) => expect(atControls[i], `${c.name} takes a click`).toBe(HT.client));

      const empty = await emptyHeaderPoints();
      expect(empty.length).toBeGreaterThan(0);
      const atEmpty = await hitTest(empty);
      empty.forEach((p, i) => expect(atEmpty[i], `x=${p.x} drags the window`).toBe(HT.caption));

      if (FRAMES_DIR && surface.frame) {
        mkdirSync(FRAMES_DIR, { recursive: true });
        for (const theme of ['dark', 'light']) {
          await page.evaluate((t) => {
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(t);
          }, theme);
          await settle(page);
          await page.screenshot({ path: join(FRAMES_DIR, `${surface.frame}-${theme}.png`) });
        }
        await page.evaluate(() => {
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add('dark');
        });
      }
    });
  }

  const openGame = async () => {
    // From the menu: the play gate only opens on entering the game.
    await gotoDev(page, 'mainMenu');
    await SURFACES.find((surface) => surface.name === 'game')?.open(page);
    await page.getByRole('button', { name: 'Save Game' }).waitFor();
    await settle(page);
  };

  /** The three panels, left to right: the root's children in the page's flow. The right column's panel is its last child. */
  const gamePanels = () => page.locator('[data-game-raised-panels]').evaluate((root) => {
    const inFlow = [...root.children].filter((el) => !['absolute', 'fixed'].includes(getComputedStyle(el).position) && el.getBoundingClientRect().height > 200);
    const box = (el: Element | null | undefined) => {
      if (!el) throw new Error('A game panel is missing');
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, width: r.width };
    };
    return { left: box(inFlow[0]), center: box(inFlow[1]), right: box(inFlow[2]?.lastElementChild) };
  });

  test('game: panels rise, the header stays above the right column', async () => {
    await openGame();
    for (const width of [1280, 1000, 800]) {
      await setSize(width, 800);
      await settle(page);
      const { left, center, right: card } = await gamePanels();
      expect(left.y, `left panel at ${width}`).toBe(16);
      expect(center.y, `center panel at ${width}`).toBe(16);
      expect(card.y, `right column at ${width}`).toBe(56);
      expect(card.width, `right column minimum at ${width}`).toBeGreaterThanOrEqual(312);
      const save = await page.getByRole('button', { name: 'Save Game' }).boundingBox();
      const more = await page.getByRole('button', { name: 'More Actions' }).boundingBox();
      if (!save || !more) throw new Error('The header has no buttons');
      expect(save.x, `Save Game stays above the right column at ${width}`).toBeGreaterThanOrEqual(card.x);
      expect(save.x, `Save Game clears the center panel at ${width}`).toBeGreaterThanOrEqual(center.right);
      expect(more.x + more.width, `More Actions clears the window buttons at ${width}`).toBeLessThanOrEqual(width - (await buttonsWidth(page)));
    }
    await setSize(1280, 800);
  });

  test('game: drags from the margin and above the right column, never from panel content', async () => {
    await openGame();
    await setSize(1280, 800);
    await settle(page);
    const { left, center, right: card } = await gamePanels();
    const save = await page.getByRole('button', { name: 'Save Game' }).boundingBox();
    if (!save) throw new Error('The header has no Save Game');
    const hits = await hitTest([
      { x: left.x + 60, y: 10 },
      { x: center.x + 60, y: 10 },
      { x: card.x + 10, y: 40 },
      { x: left.x + 60, y: 40 },
      { x: center.x + 60, y: 40 },
      { x: card.x + 10, y: 70 },
      { x: save.x + save.width / 2, y: save.y + save.height / 2 },
    ]);
    expect(hits).toEqual([HT.caption, HT.caption, HT.caption, HT.client, HT.client, HT.client, HT.client]);
    if (FRAMES_DIR) {
      mkdirSync(FRAMES_DIR, { recursive: true });
      for (const theme of ['dark', 'light']) {
        await page.evaluate((t) => {
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(t);
        }, theme);
        for (const width of [1280, 800]) {
          await setSize(width, 800);
          await settle(page);
          await page.screenshot({ path: join(FRAMES_DIR, width === 800 ? `game-800-${theme}.png` : `game-header-${theme}.png`) });
        }
      }
      await page.evaluate(() => {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add('dark');
      });
      await setSize(1280, 800);
    }
  });

  const setFullScreen = async (on: boolean) => {
    await app.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0].setFullScreen(value), on);
    await settle(page);
    await settle(page);
  };

  test('centers the main menu buttons on the window, in and out of full screen', async () => {
    await setSize(1600, 900);
    await gotoDev(page, 'mainMenu');
    await settle(page);
    await expectActionsCentered(page);
    await setFullScreen(true);
    await expectActionsCentered(page);
    await setFullScreen(false);
    await setSize(1600, 900);
    await settle(page);
    await expectActionsCentered(page);
  });

  test('lays the main menu out as the web does, apart from the room for the window buttons', async ({ browser }) => {
    await setSize(1600, 900);
    await gotoDev(page, 'mainMenu');
    await settle(page);
    const read = async (p: Page) => ({
      tabs: (await p.locator('[data-fold-left] > *').first().boundingBox())?.x ?? -1,
      actions: await actionCenter(p),
      settings: (await p.getByRole('button', { name: 'Settings' }).boundingBox())?.x ?? -1,
    });
    const desktop = await read(page);
    const web = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await openApp(web);
    await gotoDev(web, 'mainMenu');
    await settle(web);
    const browserLayout = await read(web);
    await web.close();
    expect(Math.abs(desktop.tabs - browserLayout.tabs)).toBeLessThanOrEqual(1);
    expect(Math.abs(desktop.actions - browserLayout.actions)).toBeLessThanOrEqual(1);
    // The spacer gives up the bar's own 8px gap to the edge, so the shift is the room less that gap.
    expect(Math.abs(browserLayout.settings - desktop.settings - ((await buttonsWidth(page)) - 8))).toBeLessThanOrEqual(1);
  });

  for (const mode of ['simple', 'advanced']) {
    test(`keeps the World Editor search centered in ${mode} mode, in and out of full screen`, async ({ baseURL }) => {
      await openApp(page, { 'vite-ui-theme': 'dark', FORMAMORPH_aiSetupSeen: 'true', 'formamorph.worldEditorMode': mode }, { url: baseURL as string });
      await setSize(1690, 900);
      await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'overview' });
      await page.getByRole('search').first().waitFor();
      await settle(page);
      await expectEditorBarHolds(page, 1690);
      expect(Math.abs(middle(await page.getByRole('search').first().boundingBox()) - 845)).toBeLessThanOrEqual(1);
      await setFullScreen(true);
      const width = await page.evaluate(() => window.innerWidth);
      await expectEditorBarHolds(page, width);
      expect(Math.abs(middle(await page.getByRole('search').first().boundingBox()) - width / 2)).toBeLessThanOrEqual(1);
      await setFullScreen(false);
      for (const narrow of [1280, 1100, 1000]) {
        await setSize(narrow, 800);
        await settle(page);
        await expectEditorBarHolds(page, narrow);
      }
      await gotoDev(page, 'mainMenu');
    });
  }

  type Surface = 'main menu' | 'game';
  /** The two Surfaces full screen is checked on. */
  const SURFACE_PAIR: Surface[] = ['main menu', 'game'];
  const overlayFlagged = () => page.evaluate(() => document.documentElement.dataset.windowOverlay !== undefined);
  const isFullScreen = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen());
  /** The right edge of the rightmost control on the header line. */
  const headerRight = async () => Math.max(...(await headerControls(page)).map((c) => c.right));
  const openSurface = async (name: Surface) => {
    if (name === 'game') return openGame();
    // A fresh load: the World Editor is an in-place modal that routing to the menu leaves open.
    await page.evaluate(() => {
      history.replaceState(null, '', location.pathname);
      location.reload();
    });
    await page.locator('[data-fold-live="toggle"]').waitFor();
    await gotoDev(page, 'mainMenu');
    await expect(page.getByText('World Editor', { exact: true })).toHaveCount(0);
    await settle(page);
  };

  for (const name of SURFACE_PAIR) {
    test(`${name}: full screen gives the window buttons' room to the header, and leaving brings it back`, async () => {
      await setSize(1280, 800);
      await openSurface(name);
      const gradient = page.locator('[data-window-corner-gradient]');
      await setFullScreen(true);
      expect(await overlayFlagged()).toBe(false);
      expect(await buttonsWidth(page)).toBe(0);
      const width = await page.evaluate(() => window.innerWidth);
      // Only the bar's own margin is left: 1rem on the main menu, 0.5rem in game.
      expect(width - (await headerRight()), 'the header reaches the window edge').toBeLessThanOrEqual(16);
      if (name === 'game') await expect(gradient).toBeHidden();
      if (FRAMES_DIR) {
        mkdirSync(FRAMES_DIR, { recursive: true });
        for (const theme of ['dark', 'light']) {
          await setTheme(theme);
          await settle(page);
          await page.screenshot({ path: join(FRAMES_DIR, `full-${name === 'game' ? 'game' : 'menu'}-${theme}.png`) });
        }
        await setTheme('dark');
      }

      await setFullScreen(false);
      await setSize(1280, 800);
      await settle(page);
      expect(await overlayFlagged()).toBe(true);
      const room = await buttonsWidth(page);
      expect(room).toBeGreaterThan(0);
      expect(await headerRight(), 'the header clears the window buttons again').toBeLessThanOrEqual(1280 - room);
      if (name === 'game') await expect(gradient).toBeVisible();
    });
  }

  test('keeps the full-screen layout through a reload', async () => {
    await setSize(1280, 800);
    await openSurface('main menu');
    await setFullScreen(true);
    // Records the flag from the page's first script, so a frame laid out with the room shows up.
    await page.addInitScript(() => {
      const w = window as unknown as { overlaySeen?: boolean };
      // The root element doesn't exist yet when this runs.
      new MutationObserver(() => {
        if (document.documentElement?.dataset.windowOverlay !== undefined) w.overlaySeen = true;
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-window-overlay'] });
    });
    await page.reload();
    await page.locator('[data-fold-live="toggle"]').waitFor();
    await settle(page);
    expect(await page.evaluate(() => (window as unknown as { overlaySeen?: boolean }).overlaySeen ?? false)).toBe(false);
    expect(await overlayFlagged()).toBe(false);
    expect(await buttonsWidth(page)).toBe(0);
    await expect(page.getByRole('button', { name: 'More Actions' })).toBeVisible();
    await setFullScreen(false);
    expect(await overlayFlagged()).toBe(true);
  });

  for (const name of SURFACE_PAIR) {
    test(`${name}: Exit Full Screen shows in More Actions only in full screen, and leaves it`, async () => {
      await setSize(1280, 800);
      await openSurface(name);
      const more = page.getByRole('button', { name: 'More Actions' });
      const exit = page.getByRole('button', { name: 'Exit Full Screen' });
      // The main menu has no More Actions at full width; the game's never holds the item outside full screen.
      if (name === 'main menu') await expect(more).toHaveCount(0);
      else {
        await more.click();
        await expect(page.getByRole('button', { name: 'Edit World' })).toBeVisible();
        await expect(exit).toHaveCount(0);
        await page.keyboard.press('Escape');
      }
      await setFullScreen(true);
      await more.click();
      await exit.click();
      await expect.poll(isFullScreen).toBe(false);
      await settle(page);
      expect(await overlayFlagged()).toBe(true);
      await expect(exit).toHaveCount(0);
      await setSize(1280, 800);
    });
  }

  /** Controls only one build shows in full screen, each with why. Any other difference is drift. */
  const ONE_BUILD_ONLY: { surface: Surface; name: string; build: 'desktop' | 'web'; reason: string; pushes?: string; sameSlotAs?: string }[] = [
    {
      surface: 'main menu',
      name: 'More Actions',
      build: 'desktop',
      reason: 'Holds Exit Full Screen (Q17, Q25). The web has no menu at full width.',
      // Its cell is right-aligned, so the controls left of it in the cell sit its width plus the bar's gap further left.
      pushes: '[data-fold-right]',
    },
    {
      surface: 'main menu',
      name: 'Check for updates',
      build: 'desktop',
      reason: 'The footer version opens the updater where a build can update itself, and the changelog on the web.',
      sameSlotAs: 'What’s new',
    },
  ];
  const PUSHED_CELLS = ONE_BUILD_ONLY.flatMap((k) => (k.pushes ? [k.pushes] : []));

  type Control = Box & { cells: string[]; tile: boolean };

  /** Every control a player can see, keyed by name and occurrence, with the pushed cells it sits in. */
  const allControls = (p: Page): Promise<Control[]> =>
    p.evaluate(([selector, cellSelectors]) => {
      const counts = new Map<string, number>();
      return [...document.querySelectorAll(selector)].flatMap((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.y > window.innerHeight) return [];
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (!hit || (el !== hit && !el.contains(hit))) return [];
        const base = el.getAttribute('aria-label') || (el as HTMLElement).innerText?.trim().slice(0, 30) || el.tagName;
        const n = (counts.get(base) ?? 0) + 1;
        counts.set(base, n);
        const cells = cellSelectors.filter((cell) => el.closest(cell));
        return [{ name: n > 1 ? `${base} #${n}` : base, x: r.x, y: r.y, right: r.right, bottom: r.bottom, cells, tile: !!el.closest('[data-tile-id]') }];
      });
    }, [CONTROLS, PUSHED_CELLS] as const);

  /** Lists every control that differs by more than 1px, after the named exceptions. */
  const drift = (surface: Surface, desktop: Control[], web: Control[]): string[] => {
    const known = ONE_BUILD_ONLY.filter((k) => k.surface === surface);
    const pushers = desktop.flatMap((b) => {
      const cell = known.find((k) => k.build === 'desktop' && k.name === b.name)?.pushes;
      return cell ? [{ ...b, cell }] : [];
    });
    const webByName = new Map(web.map((b) => [b.name, b]));
    // By center: the two Chromium builds round some text widths apart by under a pixel, evenly on both sides.
    const near = (a: Box, b: Box) =>
      Math.abs(a.x + a.right - b.x - b.right) / 2 <= 1 && Math.abs(a.y + a.bottom - b.y - b.bottom) / 2 <= 1;
    const at = (b: Box) => `(${b.x.toFixed(1)}–${b.right.toFixed(1)}, ${b.y.toFixed(1)}–${b.bottom.toFixed(1)})`;
    const unmatchedDesktop: Control[] = [];
    for (const d of desktop) {
      const exception = known.find((k) => k.build === 'desktop' && k.name === d.name);
      if (exception && !exception.sameSlotAs) continue;
      // A desktop-only control in a right-aligned cell moves only the controls left of it in that cell.
      const push = pushers
        .filter((p) => d.cells.includes(p.cell) && d.right <= p.x + 1)
        .reduce((sum, p) => sum + (p.right - p.x) + 8, 0);
      const spot = { ...d, x: d.x + push, right: d.right + push };
      const name = exception?.sameSlotAs ?? d.name;
      const w = webByName.get(name);
      if (w && near(spot, w)) webByName.delete(name);
      else unmatchedDesktop.push({ ...spot, name });
    }
    const unmatchedWeb = [...webByName.values()].filter((w) => !known.some((k) => k.build === 'web' && k.name === w.name));
    const problems: string[] = [];
    for (const d of unmatchedDesktop) {
      // Each profile orders its library by its own play history, so a tile may hold another world's name.
      const i = d.tile ? unmatchedWeb.findIndex((w) => w.tile && near(d, w)) : -1;
      if (i >= 0) {
        unmatchedWeb.splice(i, 1);
        continue;
      }
      const twin = unmatchedWeb.findIndex((w) => w.name === d.name);
      if (twin < 0) {
        problems.push(`${d.name}: desktop ${at(d)}, no web control there`);
        continue;
      }
      problems.push(`${d.name}: desktop ${at(d)} vs web ${at(unmatchedWeb[twin])}`);
      unmatchedWeb.splice(twin, 1);
    }
    for (const w of unmatchedWeb) problems.push(`${w.name}: web ${at(w)}, no desktop control there`);
    return problems;
  };

  // The desktop `...` folds the main menu each step 48px wider, so the narrower size sits where both builds fold alike.
  for (const size of [{ width: 1707, height: 960 }, { width: 1200, height: 800 }]) {
    test(`full screen lays out as the browser does at ${size.width}x${size.height}`, async ({ browser }) => {
      await setSize(1280, 800);
      await gotoDev(page, 'mainMenu');
      await setFullScreen(true);
      // The screen sets a full-screen window's size, so the page's viewport takes each size under test.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 0, mobile: false });
      // The same pixel ratio, since text widths round to device pixels.
      const web = await browser.newPage({ viewport: size, deviceScaleFactor: await page.evaluate(() => window.devicePixelRatio) });
      try {
        await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(size.width);
        await openApp(web);
        await gotoDev(web, 'mainMenu');
        // Both libraries hold the bundled worlds before any comparison.
        await web.getByText('Veilwood').first().waitFor();
        await page.getByText('Veilwood').first().waitFor();
        // A first load's toast would count as a control on one side only.
        await expect(web.locator('.Toastify__toast')).toHaveCount(0, { timeout: 20_000 });
        await expect(page.locator('.Toastify__toast')).toHaveCount(0, { timeout: 20_000 });
        for (const surface of SURFACE_PAIR) {
          await openSurface(surface);
          if (surface === 'game') {
            await gotoDev(web, 'gameViewer');
            await web.getByRole('button', { name: 'Continue anyway' }).click();
            await web.getByRole('button', { name: 'Save Game' }).waitFor();
          } else {
            await gotoDev(web, 'mainMenu');
            await web.locator('[data-fold-live="toggle"]').waitFor();
          }
          await settle(page);
          await settle(web);
          const problems = drift(surface, await allControls(page), await allControls(web));
          expect(problems, `${surface} at ${size.width}x${size.height}`).toEqual([]);
        }
      } finally {
        await web.close();
        await cdp.send('Emulation.clearDeviceMetricsOverride');
        await cdp.detach();
        await setFullScreen(false);
        await setSize(1280, 800);
      }
    });
  }

  // Playwright's key presses reach the page, not the native menu, so the test runs the menu item F11 triggers.
  test('F11 is still the full-screen key, and the page follows it', async () => {
    await setSize(1280, 800);
    await openSurface('main menu');
    const toggle = () => app.evaluate(({ BrowserWindow, Menu }) => {
      type RoleItem = Electron.MenuItem & { getDefaultRoleAccelerator?: () => string | undefined };
      const find = (items: Electron.MenuItem[]): RoleItem | undefined => {
        for (const item of items) {
          if (item.role?.toLowerCase() === 'togglefullscreen') return item;
          const inner = item.submenu && find(item.submenu.items);
          if (inner) return inner;
        }
        return undefined;
      };
      const item = find(Menu.getApplicationMenu()?.items ?? []);
      if (!item) return null;
      const win = BrowserWindow.getAllWindows()[0];
      item.click(undefined, win, win.webContents);
      return item.accelerator || item.getDefaultRoleAccelerator?.() || null;
    });
    expect(await toggle()).toBe('F11');
    await expect.poll(isFullScreen).toBe(true);
    await expect.poll(overlayFlagged).toBe(false);
    await toggle();
    await expect.poll(isFullScreen).toBe(false);
    await expect.poll(overlayFlagged).toBe(true);
    await setSize(1280, 800);
  });

  test('reports the three window buttons', async () => {
    await gotoDev(page, 'mainMenu');
    await settle(page);
    const width = await buttonsWidth(page);
    const right = await page.evaluate(() => window.innerWidth);
    const cell = width / 3;
    const hits = await hitTest([
      { x: right - cell * 2.5, y: 28 },
      { x: right - cell * 1.5, y: 28 },
      { x: right - cell * 0.5, y: 28 },
    ]);
    expect(hits).toEqual([HT.minimize, HT.maximize, HT.close]);
  });

  test('starts a top-right toast below the header', async () => {
    await gotoDev(page, 'mainMenu');
    await showToast(page);
    await expectToastBelowHeader(page);
  });

  test('leaves the help window its own drag handle in the header line', async () => {
    await gotoDev(page, 'mainMenu');
    await settle(page);
    await page.keyboard.press('F1');
    const help = page.getByRole('dialog', { name: 'Formaquestion' });
    // The Mascot's body is a drag handle with no button on it, so only the rule can make it clickable.
    const handle = help.locator('[data-fq-body]');
    await handle.waitFor();
    const before = await handle.boundingBox();
    if (!before) throw new Error('The help window has no drag handle');
    const center = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    // A player can drag it to the top edge. A transform puts it in the menu bar's empty stretch, clear of its controls.
    await help.evaluate((el, by) => { el.style.transform = `translate(${by.x}px, ${by.y}px)`; }, { x: 940 - center.x, y: 20 - center.y });
    await settle(page);
    expect(await hitTest([{ x: 940, y: 20 }])).toEqual([HT.client]);
    await help.evaluate((el) => { el.style.transform = ''; });
    await page.keyboard.press('F1');
  });

  test('drags while a dialog is open', async () => {
    await gotoDev(page, 'mainMenu', { modal: 'settings' });
    await page.getByRole('dialog').first().waitFor();
    await settle(page);
    expect(await hitTest([{ x: 16, y: 12 }])).toEqual([HT.caption]);
    await gotoDev(page, 'mainMenu');
  });

  /** Every symbol color the page sends, read in the main process where it reaches the overlay. */
  const watchSymbols = async () => {
    await app.evaluate(({ BrowserWindow }) => {
      const g = globalThis as unknown as { symbols?: string[] };
      if (g.symbols) return;
      const win = BrowserWindow.getAllWindows()[0] as unknown as { setTitleBarOverlay(o: { symbolColor: string }): void };
      const real = win.setTitleBarOverlay.bind(win);
      g.symbols = [];
      win.setTitleBarOverlay = (o) => { g.symbols?.push(o.symbolColor); real(o); };
    });
    return () => app.evaluate(() => (globalThis as unknown as { symbols: string[] }).symbols.at(-1));
  };
  const DIMMED = '#ffffff40';
  const foreground = () => page.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.body).color.match(/\d+/g)!.map(Number);
    return `#${[r, g, b].map((p) => p.toString(16).padStart(2, '0')).join('')}`;
  });
  const setTheme = (theme: string) => page.evaluate((t) => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(t);
  }, theme);
  /** The window as Windows paints it, native symbols included, even while another window covers it. */
  const captureWindow = async (path: string) => {
    const hwnd = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getNativeWindowHandle().readBigUInt64LE().toString());
    const script = `
      Add-Type -AssemblyName System.Drawing
      Add-Type -Namespace Fm -Name Cap -MemberDefinition '
        [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
        [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
        [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
        [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);'
      [void][Fm.Cap]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
      $h = [IntPtr]::new([long]${hwnd})
      $r = New-Object Fm.Cap+RECT
      [void][Fm.Cap]::GetClientRect($h, [ref]$r)
      $bmp = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $dc = $g.GetHdc()
      # Client area only, with the full composited content.
      [void][Fm.Cap]::PrintWindow($h, $dc, 3)
      $g.ReleaseHdc($dc)
      $bmp.Save('${resolve(path).replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)`;
    await new Promise<void>((resolve, reject) => {
      execFile('powershell.exe', ['-NoProfile', '-Command', script], (error) => (error ? reject(error) : resolve()));
    });
  };

  test('game: the corner gradient sits in the top-right corner, behind the header and the right column', async () => {
    await setSize(1280, 800);
    await openGame();
    const gradient = page.locator('[data-window-corner-gradient]');
    await expect(gradient).toBeVisible();
    const box = await gradient.boundingBox();
    expect(box && Math.round(box.x + box.width)).toBe(1280);
    expect(box?.y).toBe(0);
    // Behind every control: each one paints over it where they overlap.
    const covered = await page.evaluate(() => {
      const g = document.querySelector('[data-window-corner-gradient]')!.getBoundingClientRect();
      return ['Save Game', 'Load Game', 'Settings', 'More Actions'].map((name) => {
        const el = document.querySelector(`[aria-label="${name}"]`) ?? [...document.querySelectorAll('button')].find((b) => b.textContent === name);
        if (!el) return `${name}: missing`;
        const r = el.getBoundingClientRect();
        const overlaps = r.right > g.left && r.top < g.bottom;
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return overlaps && !!hit && (hit === el || el.contains(hit)) ? 'ok' : `${name}: not over the gradient`;
      });
    });
    expect(covered).toEqual(['ok', 'ok', 'ok', 'ok']);
    const z = await page.evaluate(() => {
      const zOf = (el: Element | null) => (el ? Number(getComputedStyle(el).zIndex) || 0 : NaN);
      return { gradient: zOf(document.querySelector('[data-window-corner-gradient]')), art: zOf(document.querySelector('[data-testid="location-backdrop-image"]')) };
    });
    expect(z.gradient).toBeLessThan(0);
    if (!Number.isNaN(z.art)) expect(z.gradient).toBeGreaterThan(z.art);
  });

  test('dims the window buttons under Settings in game, and restores the theme color after', async () => {
    const lastSymbol = await watchSymbols();
    await setSize(1280, 800);
    await openGame();
    for (const theme of ['dark', 'light']) {
      await setTheme(theme);
      const full = await foreground();
      await expect.poll(lastSymbol).toBe(full);
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.getByRole('dialog').first().waitFor();
      await expect.poll(lastSymbol).toBe(DIMMED);
      if (FRAMES_DIR) {
        mkdirSync(FRAMES_DIR, { recursive: true });
        await settle(page);
        await captureWindow(join(FRAMES_DIR, `legibility-dimmed-${theme}.png`));
      }
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect.poll(lastSymbol).toBe(full);
      if (FRAMES_DIR) {
        await settle(page);
        await captureWindow(join(FRAMES_DIR, `legibility-art-${theme}.png`));
      }
    }
    await setTheme('dark');
  });

  test('frames the window buttons over bundled world art', async () => {
    test.skip(!FRAMES_DIR, 'Frames only on request');
    mkdirSync(FRAMES_DIR as string, { recursive: true });
    await setSize(1280, 800);
    for (const [id, name] of [['rampage', 'City Rampage'], ['sugarscape', 'Sugarscape Survival'], ['veilwood', 'Veilwood']]) {
      await gotoDev(page, 'mainMenu');
      await settle(page);
      await page.getByRole('heading', { name, exact: true }).click();
      await page.getByRole('button', { name: 'Quick Start' }).first().click();
      // A world opens on its Readme, and the play gate may follow.
      const save = page.getByRole('button', { name: 'Save Game' });
      await expect(async () => {
        if (await page.getByRole('dialog', { name: 'Readme' }).isVisible()) await page.keyboard.press('Escape');
        const gate = page.getByRole('button', { name: 'Continue anyway' });
        if (await gate.isVisible()) await gate.click();
        await expect(save).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      for (const theme of ['dark', 'light']) {
        await setTheme(theme);
        await settle(page);
        await captureWindow(join(FRAMES_DIR as string, `legibility-${id}-${theme}.png`));
      }
      await setTheme('dark');
      await page.getByRole('button', { name: 'Exit to Main Menu' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).click();
      await expect(save).toBeHidden();
    }
  });

  test('dims the window buttons under an alert dialog and a nested dialog', async () => {
    const lastSymbol = await watchSymbols();
    await setSize(1280, 800);
    await openGame();
    await page.getByRole('button', { name: 'Exit to Main Menu' }).click();
    await page.getByRole('alertdialog').waitFor();
    await expect.poll(lastSymbol).toBe(DIMMED);
    await page.keyboard.press('Escape');
    await expect.poll(lastSymbol).toBe(await foreground());

    // Chip Options opens over Settings.
    await gotoDev(page, 'mainMenu');
    await settle(page);
    await gotoDev(page, 'mainMenu', { modal: 'chipOptions' });
    // The top dialog hides Settings from the accessibility tree, so count the elements.
    await expect(page.locator('[role="dialog"]')).toHaveCount(2);
    await settle(page);
    await expect.poll(lastSymbol).toBe(DIMMED);
    // Closing Chip Options leaves Settings, so its layer keeps them dim.
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await settle(page);
    expect(await lastSymbol()).toBe(DIMMED);
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect.poll(lastSymbol).toBe(await foreground());
  });

  for (const surface of SURFACES.filter((s) => s.name === 'World Editor' || s.name === 'full screen editor')) {
    test(`keeps the window buttons at full color over the ${surface.name}`, async () => {
      const lastSymbol = await watchSymbols();
      await setSize(1280, 800);
      await surface.open(page);
      await surface.ready(page).first().waitFor();
      // Past the dialog's opening animation, when its dimming layer could still show at the corner.
      await settle(page);
      const full = await foreground();
      await expect.poll(lastSymbol).toBe(full);
      await page.waitForTimeout(400);
      expect(await lastSymbol()).toBe(full);
      await gotoDev(page, 'mainMenu');
    });
  }

  /** One frame per theme in the frames folder, when set. */
  const frame = async (name: string) => {
    if (!FRAMES_DIR) return;
    mkdirSync(FRAMES_DIR, { recursive: true });
    for (const theme of ['dark', 'light']) {
      await page.evaluate((t) => {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(t);
      }, theme);
      await settle(page);
      await page.screenshot({ path: join(FRAMES_DIR, `${name}-${theme}.png`) });
    }
    await page.evaluate(() => {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add('dark');
    });
  };

  test('Avatar Customization: the controls card starts below the window buttons', async () => {
    for (const [width, height] of [[1280, 800], [800, 600]]) {
      await setSize(width, height);
      await gotoDev(page, 'mainMenu', { modal: 'avatar' });
      const card = page.getByRole('heading', { name: 'Avatar Customization' }).locator('xpath=ancestor::*[contains(@class, "overflow-hidden")][1]');
      await card.waitFor();
      await settle(page);
      const box = await card.boundingBox();
      if (!box) throw new Error('The controls card has no box');
      expect(box.y, `controls card top at ${width}`).toBeGreaterThanOrEqual(56);
      // The card's top-right corner is inside the window buttons' stretch.
      expect(box.x + box.width).toBeGreaterThan(width - (await buttonsWidth(page)));
      if (width === 800) await frame('clearance-avatar');
    }
    await setSize(1280, 800);
  });

  test('a full-height dialog keeps its close button clear of the window buttons at 800x600', async ({ baseURL }) => {
    await setSize(800, 600);
    await page.goto(baseURL as string);
    await page.waitForFunction(() => '__fmDev' in window);
    await gotoDev(page, 'mainMenu', { modal: 'settings' });
    const dialog = page.getByRole('dialog').first();
    await dialog.waitFor();
    await settle(page);
    const close = await dialog.getByRole('button', { name: 'Close' }).first().boundingBox();
    if (!close) throw new Error('The dialog has no close button');
    const wall = 800 - (await buttonsWidth(page));
    expect(close.y >= 56 || close.x + close.width <= wall, 'the close button sits below the buttons or left of them').toBe(true);
    expect(await hitTest([{ x: close.x + close.width / 2, y: close.y + close.height / 2 }])).toEqual([HT.client]);
    await frame('clearance-dialog');
    await setSize(1280, 800);
  });

  test('the help window frame', async ({ baseURL }) => {
    test.skip(!FRAMES_DIR, 'Frames only on request');
    await setSize(800, 600);
    await page.goto(baseURL as string);
    await page.waitForFunction(() => '__fmDev' in window);
    await gotoDev(page, 'mainMenu', { modal: 'formaquestion' });
    await page.getByRole('dialog', { name: 'Formaquestion' }).waitFor();
    await settle(page);
    await frame('clearance-help');
    await setSize(1280, 800);
  });
});

test.describe('corner checks', () => {
  test('runs no repeated corner checks while narration streams', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'One viewport is enough');
    await page.setViewportSize({ width: 1280, height: 800 });
    // The real window chrome over a stub bridge: the count is the page's own work. Only the window chrome
    // sees the stub, so the rest of the app stays the web build.
    await page.addInitScript(() => {
      const stub = { windowOverlay: true, setWindowSymbolColor: async () => {} };
      Object.defineProperty(window, 'formamorphDesktop', {
        configurable: true,
        get: () => (new Error().stack?.includes('installWindowChrome') ? stub : undefined),
      });
    });
    // It sends one word every 10ms, so the turn streams for about three seconds.
    const server = createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      if (req.method === 'OPTIONS') { res.end(); return; }
      if (req.url?.endsWith('/models')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{ id: 'e2e-model' }] })); return; }
      if (!req.url?.endsWith('/chat/completions')) { res.statusCode = 404; res.end(); return; }
      res.setHeader('Content-Type', 'text/event-stream');
      let i = 0;
      const timer = setInterval(() => {
        if (i === 300) { clearInterval(timer); res.end('data: [DONE]\n\n'); return; }
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `word${i} ` }, finish_reason: null }] })}\n\n`);
        i += 1;
      }, 10);
      res.on('close', () => clearInterval(timer));
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const { port } = server.address() as AddressInfo;
    try {
      await openApp(page, {
        'vite-ui-theme': 'dark',
        FORMAMORPH_endpointUrl: `http://127.0.0.1:${port}/v1/chat/completions`,
        FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
        FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
        FORMAMORPH_autosaveEnabled: false,
      }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
      const action = page.getByPlaceholder(/Type your action/);
      await action.waitFor();
      await settle(page);
      // The AI setup dialog has a download button, so nothing here presses a key while it could be open.
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.dataset.windowOverlay)).toBe('');
      // Each corner check is one hit test; count every one the page makes.
      await page.evaluate(() => {
        const w = window as unknown as { cornerChecks: number };
        w.cornerChecks = 0;
        const real = document.elementsFromPoint.bind(document);
        document.elementsFromPoint = (x, y) => {
          w.cornerChecks += 1;
          return real(x, y);
        };
      });
      await action.fill('I wait.');
      await page.getByRole('button', { name: 'Send' }).click();
      await expect(page.getByText('word299').first()).toBeVisible({ timeout: 30_000 });
      // The turn's later passes stream from the same endpoint.
      await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 30_000 });
      const checks = await page.evaluate(() => (window as unknown as { cornerChecks: number }).cornerChecks);
      // A popup or tooltip can open during a turn; three hundred chunks must not add one each.
      expect(checks).toBeLessThanOrEqual(4);
    } finally {
      server.close();
    }
  });
});
