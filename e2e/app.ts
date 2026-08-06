import type { Page } from '@playwright/test';

/** Dev-router surface installed by `src/lib/devRouter.ts` (DEV builds only). */
interface DevRouter {
  goto(view?: string, opts?: { modal?: string; tab?: string; subtab?: string; fixture?: string }): void;
}

/**
 * localStorage the app reads before the first paint. Seeded so a run lands on the Main Menu instead of
 * the first-run intro or the AI setup gate — neither is what these specs are measuring, and both would
 * make every spec start with the same two dismissals.
 */
const BASE_SEED: Record<string, string> = {
  FORMAMORPH_introSeen: 'true',
  FORMAMORPH_useCustomEndpoint: 'true',
  // Never contacted: no spec makes an AI call. It only has to be non-empty so the gate stays shut.
  FORMAMORPH_endpointUrl: 'http://127.0.0.1:9/v1/chat/completions',
  FORMAMORPH_apiToken: 'e2e',
  FORMAMORPH_modelName: 'e2e-model',
};

/**
 * Load the app with a known localStorage baseline. `extra` overrides or adds keys — strings are stored
 * raw and everything else JSON-encoded, matching the app's own persistence codecs.
 */
export async function openApp(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  const seed = { ...BASE_SEED } as Record<string, string>;
  for (const [k, v] of Object.entries(extra)) seed[k] = typeof v === 'string' ? v : JSON.stringify(v);
  await page.addInitScript((s: Record<string, string>) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  await page.goto('/');
  await page.waitForFunction(() => '__fmDev' in window);
}

/** Jump to a screen/modal/tab in one call, rather than clicking through the menus. */
export async function gotoDev(
  page: Page,
  view: string,
  opts?: { modal?: string; tab?: string; subtab?: string; fixture?: string },
): Promise<void> {
  await page.evaluate(
    ([v, o]) => (window as unknown as { __fmDev: DevRouter }).__fmDev.goto(v as string, o as Parameters<DevRouter['goto']>[1]),
    [view, opts] as const,
  );
}

/**
 * Open Settings on a prompt, with an editable (non-built-in) preset selected.
 *
 * The shipped presets are read-only, and a read-only editor takes no caret — so any spec that types or
 * places a cursor needs a user preset first. Made through the real UI so it carries the same prompt text
 * an author would be editing.
 */
export async function openPromptEditor(page: Page, prompt = 'narration'): Promise<void> {
  await gotoDev(page, 'mainMenu', { modal: 'settings', tab: 'prompts', subtab: prompt });
  await page.getByRole('combobox', { name: 'Preset' }).waitFor();
  await ensureEditablePreset(page);
}

async function ensureEditablePreset(page: Page): Promise<void> {
  const selector = page.getByRole('combobox', { name: 'Preset' });
  if ((await selector.textContent())?.includes('E2E')) return;
  await selector.click();
  await page.getByRole('option', { name: 'Add New Preset…' }).click();
  await page.getByPlaceholder('Preset name').fill('E2E');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('dialog', { name: 'New Preset' }).waitFor({ state: 'detached' });
}

/** The prompt editor's chrome buttons, named by the accessible labels the app already gives them. */
export const chrome = {
  enterFullscreen: (page: Page) => page.getByRole('button', { name: 'Edit full screen' }),
  exitFullscreen: (page: Page) => page.getByRole('button', { name: 'Exit full screen' }),
  toSplit: (page: Page) => page.getByRole('button', { name: 'Show edit and preview side by side' }),
  toTabs: (page: Page) => page.getByRole('button', { name: 'Show one pane at a time' }),
  editTab: (page: Page) => page.getByRole('tab', { name: 'Edit' }),
  previewTab: (page: Page) => page.getByRole('tab', { name: 'Preview' }),
};
