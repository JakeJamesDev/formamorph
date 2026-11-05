import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
const SURFACES: { name: string; frame?: string; line: number; open: (page: Page) => Promise<void>; ready: (page: Page) => Locator }[] = [
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

const expectOnLine = async (page: Page, line: number) => {
  const controls = await headerControls(page);
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

test.describe('web', () => {
  test.beforeEach(({ page: _page }, info) => test.skip(info.project.name !== 'desktop', 'One viewport is enough'));

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
      await test.step(surface.name, () => expectOnLine(page, surface.line));
    }
  });

  test('starts a top-right toast below the header', async ({ page }) => {
    await openApp(page);
    await showToast(page);
    await expectToastBelowHeader(page);
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
      await expectOnLine(page, surface.line);

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
});
