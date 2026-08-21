import type { Page } from '@playwright/test';
import { TUTORIALS } from '../src/lib/tutorials';

/** Dev-router surface installed by `src/lib/devRouter.ts` (DEV builds only). */
interface DevRouter {
  goto(view?: string, opts?: { modal?: string; tab?: string; subtab?: string; fixture?: string; fullscreen?: boolean }): void;
  listWorlds(): Promise<{ id: string; name: string }[]>;
  editWorld(id: string): Promise<void>;
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
  // Every tutorial pre-dismissed, read from the registry so a new one can't start covering a control.
  // A spec that wants one back clears it through `openApp`'s `extra`.
  'formamorph.tutorialsSeen': JSON.stringify(TUTORIALS.map((t) => t.id)),
  // Advanced, not the first-run Simple: Simple hides whole tabs and fields, and no spec here is
  // measuring what Simple hides. One that is should set it back.
  'formamorph.worldEditorMode': 'advanced',
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
  opts?: { modal?: string; tab?: string; subtab?: string; fixture?: string; fullscreen?: boolean },
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

/**
 * Open the World Editor on a stored world with its custom narration prompt switched on and its panel
 * open — the prompt field whose parent writes each keystroke through to GameDataContext.
 */
export async function openWorldNarrationPrompt(page: Page): Promise<void> {
  await openWorldEditor(page);
  const toggle = page.getByRole('checkbox', { name: "Use this world's narration prompt" });
  // Switching the checkbox on opens the panel itself; only an already-armed prompt needs picking open.
  if ((await toggle.getAttribute('data-state')) !== 'checked') await toggle.click();
  else await page.getByRole('radio', { name: 'Narration' }).click();
  await page.getByLabel('World narration prompt').waitFor();
}

/** Open the World Editor on a stored world, without touching its narration prompt. */
export async function openWorldEditor(page: Page): Promise<void> {
  // The bundled worlds are seeded into IndexedDB after the menu mounts, and that seeding re-renders the
  // menu — opening the editor mid-seed gets it closed again. Wait for the library to settle first.
  await page.getByText('Loaded default worlds').waitFor({ state: 'visible' });
  await page.evaluate(async () => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    const worlds = await dev.listWorlds();
    await dev.editWorld(worlds[0].id);
  });
  await page.getByRole('checkbox', { name: "Use this world's narration prompt" }).waitFor();
}

/**
 * Sign in through the footer's account button, the way a player does.
 *
 * The token could be seeded into `localStorage` instead, but a session made that way never proves the
 * login round-trip works — and every flow that needs an account needs the server to have answered.
 */
export async function signIn(page: Page, username: string, password: string): Promise<void> {
  await page.getByRole('button', { name: 'Login' }).click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByText('Enter your credentials') });
  await dialog.getByLabel('Username').fill(username);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('button', { name: /^User Profile/ }).waitFor();
}
