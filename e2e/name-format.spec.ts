import { expect, test } from '@playwright/test';
import { gotoDev, openApp, openPromptEditor } from './app';

for (const theme of ['light', 'dark']) {
for (const { base, label, sample, tag } of [
  { base: 'PERSONA', label: 'Persona', sample: 'Traveler (they/them)', tag: 'entity' },
  { base: 'LOCATION', label: 'Location', sample: 'The Landing', tag: 'location' },
  { base: 'ENTITIES', label: 'Entities', sample: 'Wren, a gull', tag: 'entity' },
]) {
  test(`${label} Name keeps its saved format without applying it in ${theme}`, async ({ page }, testInfo) => {
    await openApp(page, { 'vite-ui-theme': theme });
    await gotoDev(page, 'mainMenu', { modal: 'designSystem', tab: 'prompt-chips' });
    await expect(page.getByText('Conditional Prompt Text', { exact: true })).toBeVisible();
    await openApp(page, { 'vite-ui-theme': theme });
    await openPromptEditor(page);
    if (testInfo.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Edit full screen' }).click();
    }
    const editor = page.locator('[contenteditable="true"]').first();
    const chip = editor.locator(`[data-chip-token="<${base}|markdown>"]`);
    await chip.getByText(`${label} (Markdown)`, { exact: true }).click();
    const xml = page.getByRole('radio', { name: 'XML', exact: true });
    const formats = page.getByRole('radiogroup').filter({ has: xml });
    await xml.click();
    await page.getByRole('radio', { name: 'Name', exact: true }).click();
    for (const format of ['Simple', 'Markdown', 'XML']) {
      await expect(formats.getByRole('radio', { name: format, exact: true })).toBeDisabled();
    }
    await expect(xml).toBeChecked();
    await expect(page.getByText(base === 'PERSONA' ? 'Sends the name and pronouns as plain text' : 'Sends names as plain text', { exact: true })).toBeVisible();
    await page.screenshot({ path: `.scratch/name-format/${label}-${theme}-${testInfo.project.name}.png`, animations: 'disabled' });
    await page.getByRole('radio', { name: 'Summary', exact: true }).click();
    await expect(xml).toBeEnabled();
    await expect(xml).toBeChecked();
    await page.getByRole('radio', { name: 'Full', exact: true }).click();
    await expect(xml).toBeEnabled();
    await expect(xml).toBeChecked();
    await page.getByRole('radio', { name: 'Name', exact: true }).click();
    await page.keyboard.press('Escape');
    if (testInfo.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Exit full screen' }).click();
    }
    await page.getByRole('tab', { name: 'Preview', exact: true }).click();
    const preview = page.getByRole('tabpanel', { name: 'Preview', exact: true });
    const value = preview.locator('mark').filter({ hasText: base === 'PERSONA' ? '## Player Character' : sample });
    await expect(value).toHaveText(base === 'PERSONA' ? `\n## Player Character\n${sample}\n` : sample);
    await expect(preview).not.toContainText(`<${tag}>${sample}</${tag}>`);
  });
}
}
