import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoDev, openApp, openPromptEditor } from './app';
import { decodePlaceholderToken } from '../src/lib/placeholders';
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
  placeholders: [{ id: 'ph-town', name: 'Town', values: [
    { id: 'town-0', text: 'Harrow' }, { id: 'town-1', text: 'Merrow' },
  ] }],
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

const promptField = (page: Page) => page.locator('div.flex.flex-col.gap-2')
  .filter({ has: page.getByRole('button', { name: /^(Edit|Exit) full screen$/ }) }).last();

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
  reopen: async (page) => {
    const save = page.getByRole('button', { name: 'Save', exact: true });
    await save.click();
    await expect(save).toBeDisabled();
    await page.reload();
    await page.waitForFunction(() => '__fmDev' in window);
    await page.evaluate(async (id) => {
      await (window as unknown as { __fmDev: DevRouter }).__fmDev.editWorld(id);
    }, WORLD.id);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'entities', subtab: 'descriptions' });
    await page.getByText('Walker', { exact: true }).first().click();
    const field = page.locator('[data-find-field="AI-Facing Description"]');
    return { field, editor: field.locator('[contenteditable="true"]').first(),
      paletteChip: page.locator('[data-editor-find-skip]').getByRole('button', { name: 'Town', exact: true }), chipLabel: 'Town' };
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
      field: promptField(page),
      editor,
      paletteChip: page.getByRole('button', { name: 'Persona', exact: true }).first(),
      chipLabel: 'Persona',
    };
  },
  reopen: async (page) => {
    await page.reload();
    await page.waitForFunction(() => '__fmDev' in window);
    await openPromptEditor(page);
    const editor = page.locator('[contenteditable="true"]').first();
    return { field: promptField(page), editor,
      paletteChip: page.getByRole('button', { name: 'Persona', exact: true }).first(), chipLabel: 'Persona' };
  },
};

chipInteractionContract(WORLD_ADAPTER);
chipInteractionContract(SETTINGS_ADAPTER);

test('a World palette drag chooses the destination instead of the remembered click target', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
  const { field, paletteChip } = await openWorldField(page);
  const remembered = page.locator('[data-find-field="Player-Facing Description"] [contenteditable="true"]').first();
  await setChipFieldText(page, remembered, 'Remembered');
  const destination = field.locator('[contenteditable="true"]').first();
  await dragChipToEnd(paletteChip, destination);
  await expect(remembered).toHaveText('Remembered');
  await expect(destination).toHaveText('Before afterTown');
  await expect(destination).toBeFocused();
  await page.keyboard.type('Z');
  await expect(destination).toHaveText('Before afterTownZ');
});

test('Settings retains keyboard and touch palette insertion', async ({ page }, testInfo) => {
  const surface = await SETTINGS_ADAPTER.open(page);
  await surface.field.getByRole('button', { name: 'Edit full screen' }).click();
  await surface.editor.click({ position: await beforeText(surface.editor, 'You are the narrator') });
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Before after');
  await expect(surface.editor).toHaveText('Before after');
  await page.keyboard.press('Home');
  if (testInfo.project.name === 'mobile') await surface.paletteChip.tap();
  else {
    await surface.paletteChip.focus();
    await page.keyboard.press('Enter');
  }
  await expect(surface.editor).toHaveText('PersonaBefore after');
  await expect(surface.editor).toBeFocused();
  await page.keyboard.type('Z');
  await expect(surface.editor).toHaveText('PersonaZBefore after');
});

test('World retains keyboard and touch typeahead insertion in fullscreen', async ({ page }, testInfo) => {
  const { field } = await openWorldField(page);
  await field.getByRole('button', { name: 'Edit full screen' }).click();
  const editor = page.locator('[contenteditable="true"]:visible').last();
  await setChipFieldText(page, editor, 'Before after');
  await page.keyboard.press('Home');
  await page.keyboard.type('{Town');
  const option = page.getByTestId('chip-typeahead-row').filter({ hasText: 'Town' }).first();
  await expect(option).toBeVisible();
  if (testInfo.project.name === 'mobile') await option.tap();
  else await page.keyboard.press('Enter');
  await expect(editor).toHaveText('TownBefore after');
  await expect(editor).toBeFocused();
  await page.keyboard.type('Z');
  await expect(editor).toHaveText('TownZBefore after');
});

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
  await options.getByText('XML', { exact: true }).click();
  await options.getByLabel('Prepend').fill('Lead ');
  await options.getByLabel('Prepend').press('End');
  await page.keyboard.type('heading ');
  await expect(options.getByLabel('Prepend')).toBeFocused();
  await page.keyboard.press('Enter');
  await options.getByLabel('Append').fill(' tail');
  await options.getByLabel('Append').press('Home');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  const token = await placed.locator('[data-chip-token]').getAttribute('data-chip-token');
  expect(token).toContain('|name');
  expect(token).toContain('xml');
  await expect(placed).toHaveJSProperty('textContent', 'Lead heading \nPersona (Name, XML)\n tail');

  await dragChipToEnd(placed, surface.editor);

  await expect(surface.editor.locator('[data-chip-token]')).toHaveAttribute('data-chip-token', token!);
  await expect(surface.editor).toHaveJSProperty('textContent', 'Before afterLead heading \nPersona (Name, XML)\n tail');
  await placed.getByText('Persona (Name, XML)', { exact: true }).click();
  await expect(page.getByLabel('Prepend')).toHaveValue('Lead heading ↵');
  await expect(page.getByLabel('Append')).toHaveValue('↵ tail');
});

test('World palette insertion creates fresh placements and a Unique move retains its identity', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
  const surface = await WORLD_ADAPTER.open(page);
  await setChipFieldText(page, surface.editor, 'Before after');
  await surface.paletteChip.dragTo(surface.editor, { targetPosition: await beforeText(surface.editor, 'Before') });
  const placed = surface.editor.locator('[data-lexical-decorator]').first();
  await placed.getByText('Town', { exact: true }).click();
  await page.getByRole('dialog').getByText('Unique', { exact: true }).click();
  await page.keyboard.press('Escape');
  const token = await placed.locator('[data-chip-token]').getAttribute('data-chip-token');
  expect(decodePlaceholderToken(token!)?.mode).toBe('unique');
  await dragChipToEnd(placed, surface.editor);
  await expect(surface.editor.locator('[data-chip-token]')).toHaveAttribute('data-chip-token', token!);
  await dragChipToEnd(surface.paletteChip, surface.editor);
  const tokens = await surface.editor.locator('[data-chip-token]').evaluateAll((chips) => chips.map((chip) => chip.getAttribute('data-chip-token')!));
  expect(tokens).toHaveLength(2);
  expect(tokens[0]).toBe(token);
  const first = decodePlaceholderToken(tokens[0])!;
  const second = decodePlaceholderToken(tokens[1])!;
  expect(second.id).toBe(first.id);
  expect(second.mode).toBe('world');
  expect(second.placementId).not.toBe(first.placementId);
  expect(second.placementId).not.toBe('palette');
});

test('the production showcase preserves conditional text and protects read-only placeholder fields', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
  await openApp(page);
  await gotoDev(page, 'mainMenu', { modal: 'designSystem', tab: 'prompt-chips' });
  const promptCard = page.locator('.bg-card').filter({ has: page.getByRole('heading', { name: 'Conditional Prompt Text', exact: true }) });
  const worldCard = page.locator('.bg-card').filter({ has: page.getByRole('heading', { name: 'Placeholder Chips', exact: true }) });
  await expect(promptCard.locator('mark').filter({ hasText: 'Player Character' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Persona Present' }).click();
  await promptCard.getByRole('tab', { name: 'Preview', exact: true }).click();
  await expect(promptCard.getByTestId('prompt-preview')).not.toContainText('Player Character');
  await promptCard.getByRole('tab', { name: 'Edit', exact: true }).click();
  const source = worldCard.getByRole('button', { name: 'Town', exact: true });
  const notes = worldCard.getByRole('textbox', { name: 'Notes', exact: true });
  await worldCard.scrollIntoViewIfNeeded();
  await dragChipToEnd(source, notes);
  await expect(notes.locator('[data-chip-token]')).toHaveCount(1);
  await page.getByRole('checkbox', { name: 'Read-Only', exact: true }).click();
  await expect(notes).toHaveAttribute('contenteditable', 'false');
  await worldCard.scrollIntoViewIfNeeded();
  await dragChipToEnd(source, notes);
  await expect(notes.locator('[data-chip-token]')).toHaveCount(1);
  await expect(page.locator('[data-chip-drop-caret]:visible')).toHaveCount(0);
  await expect(promptCard.getByRole('button', { name: 'Persona', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Read-Only', exact: true }).click();
  await worldCard.scrollIntoViewIfNeeded();
  await dragChipToEnd(source, notes);
  await expect(notes.locator('[data-chip-token]')).toHaveCount(2);
  await page.screenshot({ path: '.scratch/chip-drag/showcase-placeholders.png', animations: 'disabled' });
  await page.getByRole('heading', { name: 'Conditional Prompt Text', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.scratch/chip-drag/showcase.png', animations: 'disabled', fullPage: true });
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
