import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoDev, openApp, openPromptEditor } from './app';
import {
  beforeText, chipInteractionContract, dragChipToEnd, setChipFieldText, type ChipSurfaceAdapter,
} from './chipInteraction';

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

interface StoredWorld {
  entities?: Array<{ id: string; aiDescription?: string }>;
}

const WORLD = {
  id: 'e2e-chip-interaction',
  worldOverview: { name: 'E2E Chip Interaction', description: '', author: '' },
  locations: [],
  stats: [],
  entities: [{ id: 'ent-0', name: 'Walker', type: 'Person', aiDescription: 'Before after' }],
  traits: [],
  statUpdates: [],
  placeholders: [{ id: 'ph-town', name: 'Town', values: [{ id: 'town-0', text: 'Harrow' }] }],
};

async function openWorldField(page: Page): Promise<{ field: Locator; paletteChip: Locator }> {
  await openApp(page);
  await page.evaluate(async (world) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    await dev.editWorld(await dev.putWorld(world));
  }, WORLD);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'entities', subtab: 'descriptions' });
  await page.getByText('Walker', { exact: true }).first().click();
  const field = page.locator('[data-find-field="AI-Facing Description"]');
  await expect(field).toBeVisible();
  return {
    field,
    paletteChip: page.locator('[data-editor-find-skip]').getByRole('button', { name: 'Town', exact: true }),
  };
}

const fieldOf = (editor: Locator) => editor.locator('xpath=ancestor::div[contains(@class,"gap-2")][1]');

const WORLD_ADAPTER: ChipSurfaceAdapter = {
  name: 'World Editor',
  open: async (page) => {
    const { field, paletteChip } = await openWorldField(page);
    return {
      field,
      editor: field.locator('[contenteditable="true"]').first(),
      paletteChip,
      chipLabel: 'Town',
    };
  },
};

const SETTINGS_ADAPTER: ChipSurfaceAdapter = {
  name: 'Settings Prompts',
  open: async (page) => {
    await openApp(page);
    await openPromptEditor(page);
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible();
    return {
      field: fieldOf(editor),
      editor,
      paletteChip: page.getByRole('button', { name: 'Persona', exact: true }).first(),
      chipLabel: 'Persona',
    };
  },
};

chipInteractionContract(WORLD_ADAPTER);
chipInteractionContract(SETTINGS_ADAPTER);

test('a World Editor palette drag creates one placement after the field has focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
  const { field, paletteChip } = await openWorldField(page);
  const editor = field.locator('[contenteditable="true"]').first();
  await setChipFieldText(page, editor, 'Before after');
  await page.keyboard.press('Home');

  await dragChipToEnd(paletteChip, editor);

  await expect(field.locator('[data-lexical-decorator]')).toHaveCount(1);
  await expect(editor).toHaveText('Before afterTown');
});

test('a World Editor palette drag targets an unfocused empty field', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
  const { field, paletteChip } = await openWorldField(page);
  const editor = field.locator('[contenteditable="true"]').first();
  await setChipFieldText(page, editor, '');
  await paletteChip.focus();
  await expect(paletteChip).toHaveAttribute('aria-disabled', 'true');

  await dragChipToEnd(paletteChip, editor);

  await expect(field.locator('[data-lexical-decorator]')).toHaveCount(1);
  await expect(editor).toHaveText('Town');
});

test('a moved prompt chip keeps its variant and byte-exact affix whitespace', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
  const surface = await SETTINGS_ADAPTER.open(page);
  await setChipFieldText(page, surface.editor, 'Before after');
  await page.keyboard.press('Home');
  await surface.paletteChip.click();
  const placed = surface.editor.locator('[data-lexical-decorator]').first();
  await placed.getByText('Persona', { exact: true }).click();
  const options = page.getByRole('dialog');
  await options.getByText('Name', { exact: true }).click();
  await options.getByLabel('Prepend').fill('Lead ');
  await options.getByLabel('Append').fill(' tail');
  await page.keyboard.press('Escape');
  const token = await placed.locator('[data-chip-token]').getAttribute('data-chip-token');
  expect(token).toContain('|name');
  await expect(surface.editor.locator('mark')).toHaveText(['Lead ', ' tail']);

  await dragChipToEnd(placed, surface.editor);

  await expect(surface.editor.locator('[data-chip-token]')).toHaveAttribute('data-chip-token', token!);
  await expect(surface.editor.locator('mark')).toHaveText(['Lead ', ' tail']);
  await expect(surface.editor).toHaveText('Before afterLead Persona (Name) tail');
});

test('the shared drop caret moves a prompt chip through wrapped text in narrow full screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
  await page.setViewportSize({ width: 700, height: 800 });
  const surface = await SETTINGS_ADAPTER.open(page);
  await surface.field.getByRole('button', { name: 'Edit full screen' }).click();
  const text = 'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron '
    + 'pi rho sigma tau upsilon phi chi psi omega alpha beta gamma delta epsilon target omega';
  await setChipFieldText(page, surface.editor, text);
  await page.keyboard.press('End');
  await surface.paletteChip.click();
  const placed = surface.editor.locator('[data-lexical-decorator]').first();
  const target = await beforeText(surface.editor, 'target');
  const start = await beforeText(surface.editor, 'Alpha');
  expect(target.y).toBeGreaterThan(start.y + 4);

  await placed.dragTo(surface.editor, { targetPosition: target });

  await expect(surface.editor).toHaveText(text.replace('target', 'Personatarget'));
});

test('a committed World Editor move survives save and reopen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
  const surface = await WORLD_ADAPTER.open(page);
  await setChipFieldText(page, surface.editor, 'Before after');
  await page.keyboard.press('Home');
  await surface.paletteChip.click();
  await dragChipToEnd(surface.editor.locator('[data-lexical-decorator]').first(), surface.editor);
  const token = await surface.editor.locator('[data-chip-token]').getAttribute('data-chip-token');
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();

  const stored = await page.evaluate(async (id) => {
    const dev = (window as unknown as { __fmDev: DevRouter & { getWorld(id: string): Promise<StoredWorld> } }).__fmDev;
    return dev.getWorld(id);
  }, WORLD.id);
  expect(stored.entities?.find((entity) => entity.id === 'ent-0')?.aiDescription)
    .toBe(`Before after${token}`);

  await page.reload();
  await page.waitForFunction(() => '__fmDev' in window);
  await page.evaluate(async (id) => {
    await (window as unknown as { __fmDev: DevRouter }).__fmDev.editWorld(id);
  }, WORLD.id);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'entities', subtab: 'descriptions' });
  await page.getByText('Walker', { exact: true }).first().click();
  await expect(page.locator('[data-find-field="AI-Facing Description"] [contenteditable="true"]').first())
    .toHaveText('Before afterTown');
});

test('a committed Settings prompt move survives reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
  const surface = await SETTINGS_ADAPTER.open(page);
  const marker = 'Persistent prompt text';
  await setChipFieldText(page, surface.editor, marker);
  await page.keyboard.press('Home');
  await surface.paletteChip.click();
  await dragChipToEnd(surface.editor.locator('[data-lexical-decorator]').first(), surface.editor);
  await expect(surface.editor).toHaveText(`${marker}Persona`);

  await page.reload();
  await page.waitForFunction(() => '__fmDev' in window);
  await openPromptEditor(page);
  await expect(page.locator('[contenteditable="true"]').first()).toHaveText(`${marker}Persona`);
});

for (const theme of ['light', 'dark'] as const) {
  test(`the drop caret uses the ${theme} theme foreground`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
    await page.addInitScript((nextTheme) => localStorage.setItem('vite-ui-theme', nextTheme), theme);
    const surface = await WORLD_ADAPTER.open(page);
    await setChipFieldText(page, surface.editor, 'Before after');
    await page.keyboard.press('Home');
    await surface.paletteChip.click();
    const placed = surface.editor.locator('[data-lexical-decorator]').first();
    const sourceBox = await placed.boundingBox();
    const editorBox = await surface.editor.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(editorBox).not.toBeNull();

    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(editorBox!.x + editorBox!.width - 8, editorBox!.y + editorBox!.height / 2, { steps: 8 });
    const caret = page.locator('[data-chip-drop-caret]:visible');
    await expect(caret).toHaveCount(1);
    const colors = await caret.evaluate((element) => {
      const probe = document.createElement('div');
      probe.style.background = 'hsl(var(--foreground))';
      document.body.appendChild(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { actual: getComputedStyle(element).backgroundColor, expected };
    });
    expect(colors.actual).toBe(colors.expected);
    await testInfo.attach(`${theme}-chip-drop-caret`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('[data-chip-drop-caret]:visible')).toHaveCount(0);
  });
}

test('read-only and Preview prompt states expose no draggable placement', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
  await openApp(page);
  await gotoDev(page, 'mainMenu', { modal: 'settings', tab: 'prompts', subtab: 'narration', surface: 'system' });
  const readOnlyEditor = page.locator('[data-lexical-editor]').first();
  await expect(readOnlyEditor).toHaveAttribute('contenteditable', 'false');
  await expect(readOnlyEditor.locator('[draggable="true"]')).toHaveCount(0);

  const surface = await SETTINGS_ADAPTER.open(page);
  await setChipFieldText(page, surface.editor, 'Before after');
  await page.keyboard.press('Home');
  await surface.paletteChip.click();
  await surface.field.getByRole('tab', { name: 'Preview' }).click();
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(page.locator('[draggable="true"]')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Edit' }).click();
  await expect(page.locator('[contenteditable="true"]').first()).toHaveText('PersonaBefore after');
});
