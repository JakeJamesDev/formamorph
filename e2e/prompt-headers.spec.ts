import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoDev, openApp, openPromptEditor, openWorldNarrationPrompt } from './app';
import { beforeText, setChipFieldText } from './chipInteraction';
import type { PromptPresetStore } from '../src/lib/promptPresets';

const TOKEN = '<PERSONA|name.xml|pre="Meet "|post="."|header="NPC notes">';
type Host = 'settings' | 'world';

async function openHost(page: Page, host: Host, reopen = false) {
  if (host === 'settings') await openPromptEditor(page);
  else if (reopen) {
    await page.evaluate(async () => {
      const dev = (window as unknown as { __fmDev: { listWorlds(): Promise<{ id: string }[]>; editWorld(id: string): Promise<void> } }).__fmDev;
      await dev.editWorld((await dev.listWorlds())[0].id);
    });
    await page.getByRole('radio', { name: 'Narration', exact: true }).click();
  }
  else await openWorldNarrationPrompt(page);
  const editor = host === 'settings' ? page.locator('[contenteditable="true"]').first() : page.getByRole('textbox', { name: 'World narration prompt', exact: true });
  const field = editor.locator('xpath=ancestor::div[contains(@class,"gap-2")][1]');
  if ((page.viewportSize()?.width ?? 1280) < 768) await field.getByRole('button', { name: 'Edit full screen' }).click();
  return { editor, field };
}

async function stored(page: Page, host: Host): Promise<string> {
  await expect(page.getByLabel('Header', { exact: true })).toHaveCount(0);
  if (host === 'settings') return page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('FORMAMORPH_promptPresets')!) as PromptPresetStore;
    return store.presets.find(preset => preset.id === store.activeId)!.values.systemPrompt;
  });
  const exit = page.getByRole('button', { name: 'Exit full screen' });
  if (await exit.isVisible()) await exit.click();
  const save = page.getByRole('button', { name: 'Save', exact: true });
  if (await save.isEnabled()) { await save.click(); await expect(save).toBeDisabled(); }
  return page.evaluate(async () => {
    const dev = (window as unknown as { __fmDev: {
      listWorlds(): Promise<{ id: string }[]>;
      getWorld(id: string): Promise<{ worldOverview: { promptOverrides?: { systemPrompt?: string } } }>;
    } }).__fmDev;
    return (await dev.getWorld((await dev.listWorlds())[0].id)).worldOverview.promptOverrides?.systemPrompt ?? '';
  });
}

async function author(page: Page, editor: Locator, field: Locator, family: 'Persona' | 'Notes') {
  await setChipFieldText(page, editor, 'Before');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('After');
  await expect(editor).toHaveText('Before\n\nAfter', { useInnerText: true });
  await page.keyboard.press('Control+Home');
  await field.getByRole('button', { name: family, exact: true }).click();
  await editor.locator('[data-chip]').click();
  await page.getByLabel('Header', { exact: true }).pressSequentially('NPC notes');
  await expect(page.getByLabel('Header', { exact: true })).toBeFocused();
  await page.getByRole('radio', { name: 'XML', exact: true }).click();
  if (family === 'Persona') await page.getByRole('radio', { name: 'Name', exact: true }).click();
  await page.getByLabel('Prepend', { exact: true }).fill('Meet ');
  await page.getByLabel('Append', { exact: true }).fill('.');
  await page.keyboard.press('Escape');
  await expect(editor.locator('mark').filter({ hasText: '<npc_notes>' })).toBeVisible();
}

for (const family of ['Persona', 'Notes'] as const) {
  const placement = family === 'Persona' ? TOKEN : '<NOTES|pre="Meet "|post="."|format=xml|header="NPC notes">';
  for (const host of ['settings', 'world'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${host}: ${family} Header editing, ownership, clipboard and persistence (${theme})`, async ({ page }, info) => {
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        await openApp(page, { 'vite-ui-theme': theme, FORMAMORPH_promptSplitMode: 'tabs', FORMAMORPH_fontFamily: 'lexend' });
        const { editor, field } = await openHost(page, host);
        await author(page, editor, field, family);
        await editor.getByText('</npc_notes>', { exact: true }).click();
        await expect(page.getByLabel('Header', { exact: true })).toHaveValue('NPC notes');
        await page.getByRole('radio', { name: 'Markdown', exact: true }).click();
        await expect(page.getByLabel('Header', { exact: true })).toHaveValue('NPC notes');
        if (family === 'Persona') {
          await page.getByRole('radio', { name: 'Summary', exact: true }).click();
          await page.getByRole('radio', { name: 'Name', exact: true }).click();
        }
        await page.getByLabel('Header', { exact: true }).fill('');
        if (family === 'Persona') await expect(page.getByRole('radio', { name: 'XML', exact: true })).toBeDisabled();
        else await expect(page.getByRole('radio', { name: 'XML', exact: true })).toHaveCount(0);
        await expect(page.getByLabel('Prepend', { exact: true })).toHaveValue('Meet ');
        await page.getByLabel('Header', { exact: true }).fill('NPC notes');
        await page.getByRole('radio', { name: 'XML', exact: true }).click();
        const headerBox = await page.getByLabel('Header', { exact: true }).boundingBox();
        expect(headerBox!.x).toBeGreaterThanOrEqual(0);
        expect(headerBox!.x + headerBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
        await page.screenshot({ path: `.scratch/prompt-headers/${host}-${family}-${theme}-${info.project.name}.png`, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await editor.click({ position: await beforeText(editor, 'Before') });
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Control+c');
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(`${placement}Before\n\nAfter`);
        await page.keyboard.press('Control+End');
        await expect.poll(() => page.evaluate(() => window.getSelection()?.isCollapsed)).toBe(true);
        await page.keyboard.press('Control+v');
        await expect(editor.locator('[data-chip-token]')).toHaveCount(2);
        await page.keyboard.press('Control+z');
        await expect(editor.locator('[data-chip-token]')).toHaveCount(1);
        await page.keyboard.press('Control+Shift+z');
        await expect(editor.locator('[data-chip-token]')).toHaveCount(2);
        const expected = `${placement}Before\n\nAfter${placement}Before\n\nAfter`;
        expect(await stored(page, host)).toBe(expected);
        await page.reload();
        await page.waitForFunction(() => '__fmDev' in window);
        const reopened = await openHost(page, host, true);
        await expect(reopened.editor.locator('[data-chip-token]')).toHaveCount(2);
        await reopened.editor.getByText('<npc_notes>', { exact: true }).first().click();
        await expect(page.getByLabel('Header', { exact: true })).toHaveValue('NPC notes');
        await expect(page.getByLabel('Prepend', { exact: true })).toHaveValue('Meet ');
      });
    }

    test(`${host}: ${family} headed chips move, cancel, reject self-drops, and undo`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'Native dragging uses a pointer');
      await openApp(page, { FORMAMORPH_promptSplitMode: 'tabs' });
      const { editor, field } = await openHost(page, host);
      await author(page, editor, field, family);
      const chip = editor.locator('[data-chip]');
      for (const text of ['<npc_notes>', '</npc_notes>']) {
        await chip.dragTo(editor.getByText(text, { exact: true }));
        await expect(page.locator('[data-chip-drop-caret]:visible')).toHaveCount(0);
        await expect(editor.locator('[data-chip]')).toHaveCount(1);
        expect(await stored(page, host)).toBe(`${placement}Before\n\nAfter`);
      }
      const target = await beforeText(editor, 'After');
      await chip.dragTo(editor, { targetPosition: target });
      expect(await stored(page, host)).toBe(`Before\n\n${placement}After`);
      await field.getByRole('button', { name: 'Undo', exact: true }).click();
      expect(await stored(page, host)).toBe(`${placement}Before\n\nAfter`);
      await field.getByRole('button', { name: 'Redo', exact: true }).click();
      expect(await stored(page, host)).toBe(`Before\n\n${placement}After`);
      const before = await beforeText(editor, 'Before');
      const after = await beforeText(editor, 'After');
      const lineHeight = await editor.evaluate(element => parseFloat(getComputedStyle(element).lineHeight));
      await chip.dragTo(editor, { targetPosition: { x: before.x, y: before.y + lineHeight } });
      expect(await stored(page, host)).toBe(`Before\n${placement}\nAfter`);
      const start = (await chip.boundingBox())!;
      const box = (await editor.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + after.x, box.y + after.y, { steps: 10 });
      await page.keyboard.press('Escape');
      await page.mouse.up();
      expect(await stored(page, host)).toBe(`Before\n${placement}\nAfter`);
      if (family === 'Notes') {
        await editor.getByText('</npc_notes>', { exact: true }).click();
        await page.getByLabel('Header', { exact: true }).fill('');
        await page.keyboard.press('Escape');
        const hidden = '<NOTES|pre="Meet "|post="."|format=xml>';
        await chip.dragTo(editor, { targetPosition: await beforeText(editor, 'Before') });
        expect(await stored(page, host)).toBe(`${hidden}Before\n\nAfter`);
        await field.getByRole('button', { name: 'Undo', exact: true }).click();
        expect(await stored(page, host)).toBe(`Before\n${hidden}\nAfter`);
        await field.getByRole('button', { name: 'Redo', exact: true }).click();
        expect(await stored(page, host)).toBe(`${hidden}Before\n\nAfter`);
        await chip.click();
        await page.getByLabel('Header', { exact: true }).fill('NPC notes');
        await expect(page.getByRole('radio', { name: 'XML', exact: true })).toHaveAttribute('data-state', 'on');
        await page.keyboard.press('Escape');
        expect(await stored(page, host)).toBe(`${placement}Before\n\nAfter`);
      }
    });
  }

}

test('the production reference protects Header and generated tags in read-only mode', async ({ page }) => {
  await openApp(page);
  await gotoDev(page, 'mainMenu', { modal: 'designSystem', tab: 'prompt-chips' });
  await page.getByRole('checkbox', { name: 'Read-Only', exact: true }).click();
  if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole('button', { name: 'Edit full screen' }).first().click();
  await page.getByText('## Player Character', { exact: true }).click();
  await expect(page.getByLabel('Header', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Prepend', { exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByText('</player_notes>', { exact: true }).click();
  await expect(page.getByLabel('Header', { exact: true })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'XML', exact: true })).toBeDisabled();
});

for (const host of ['settings', 'world'] as const) {
  test(`${host}: cleared Header remembers Format through saving, copying and variant edits`, async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await openApp(page, { FORMAMORPH_promptSplitMode: 'tabs' });
    let { editor, field } = await openHost(page, host);
    await editor.focus();
    await page.keyboard.press('Control+a');
    await page.evaluate(() => navigator.clipboard.writeText('<DICTIONARY>'));
    await page.keyboard.press('Control+v');
    await editor.locator('[data-chip]').click();
    await expect(page.getByRole('radio', { name: 'Simple', exact: true })).toHaveCount(0);
    await page.getByLabel('Header', { exact: true }).fill('lore');
    await expect(page.getByRole('radio', { name: 'Simple', exact: true })).toHaveAttribute('data-state', 'on');
    await page.getByRole('radio', { name: 'XML', exact: true }).click();
    await page.getByLabel('Header', { exact: true }).fill('');
    await expect(page.getByRole('radio', { name: 'XML', exact: true })).toHaveCount(0);
    await page.getByRole('radio', { name: 'Background', exact: true }).click();
    await page.keyboard.press('Escape');
    expect(await stored(page, host)).toBe('<DICTIONARY|before|format=xml>');
    await page.reload();
    await page.waitForFunction(() => '__fmDev' in window);
    ({ editor, field } = await openHost(page, host, true));
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('<DICTIONARY|before|format=xml>');
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Control+v');
    await expect(editor.locator('[data-chip]')).toHaveCount(2);
    await field.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(editor.locator('[data-chip]')).toHaveCount(1);
    await editor.locator('[data-chip]').click();
    await expect(page.getByRole('radio', { name: 'Background', exact: true })).toHaveAttribute('data-state', 'on');
    await page.getByLabel('Header', { exact: true }).fill('lore');
    await expect(page.getByRole('radio', { name: 'XML', exact: true })).toHaveAttribute('data-state', 'on');
    await page.getByRole('radio', { name: 'Foreground', exact: true }).click();
    await page.keyboard.press('Escape');
    expect(await stored(page, host)).toBe('<DICTIONARY|format=xml|header="lore">');
  });
}

test('world JSON export and import retain editable Header tokens and legacy prompt text', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Serialization is independent of viewport');
  await openApp(page);
  const result = await page.evaluate(async token => {
    const paths = ['/src/lib/worldFile.ts', '/src/lib/jsonFileWorkerUtils.ts', '/src/lib/version.ts'];
    const [{ serializeWorldFile }, { parseJsonText, terminateWorker }, { migrateWorld }] = await Promise.all(paths.map(path => import(path)));
    const world = { worldOverview: { name: 'Header Round Trip', description: '', author: '',
      promptOverrides: { systemPrompt: token, choicesPrompt: '## Custom\n<PERSONA|pre="Meet "|post=".">',
        directorPrompt: '<DICTIONARY|before|format=xml>', timePrompt: '<TIME|format=markdown|header="story clock">' } },
      entities: [], locations: [], stats: [], traits: [], statUpdates: [], placeholders: [] };
    try {
      const blob = await serializeWorldFile(world);
      const parsed = await parseJsonText(await blob.text());
      return migrateWorld(parsed).worldOverview.promptOverrides;
    } finally { terminateWorker(); }
  }, TOKEN);
  expect(result).toMatchObject({ systemPrompt: TOKEN, choicesPrompt: '## Custom\n<PERSONA|pre="Meet "|post=".">',
    directorPrompt: '<DICTIONARY|before|format=xml>', timePrompt: '<TIME|format=markdown|header="story clock">' });
});
