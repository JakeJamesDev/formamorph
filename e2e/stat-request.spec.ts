import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp, gotoDev } from './app';

for (const theme of ['dark', 'light']) {
test(`formatted stat names update, keep pins live, and report skipped replies (${theme})`, async ({ page }, testInfo) => {
  page.on('pageerror', (error) => console.error(error.message));
  const health = {
    id: 'stat-resolve', name: '{{ph:stat-color:world:health-name}}', type: 'number', description: 'Physical condition.',
    min: 0, max: 100, starting: 100, value: 100, regen: 10, code: '', descriptors: [
      { id: 'lower', threshold: 90, description: 'Health is high', placeholderPins: [{ placeholderId: 'stat-color', value: '=g=Health==', valueId: 'green' }] },
      { id: 'upper', threshold: 120, description: 'Health is optimal', placeholderPins: [{ placeholderId: 'stat-color', value: '=c=Health==', valueId: 'cyan' }] },
    ],
  };
  for (const kind of ['World', 'Save']) {
    const fixture = JSON.parse(readFileSync(`src/lib/devFixtures/whiteRoom${kind}.json`, 'utf8'));
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if ('id' in value && value.id === health.id && 'name' in value) Object.assign(value, health);
      Object.values(value).forEach(visit);
    };
    visit(fixture);
    if (kind === 'World') fixture.placeholders = [{ id: 'stat-color', name: 'Stat Color', roll: true,
      values: [{ id: 'cyan', text: '=c=Health==' }, { id: 'green', text: '=g=Health==' }] }];
    await page.route(`**/whiteRoom${kind}.json*`, (route) => route.fulfill({
      contentType: 'application/javascript', body: `export default ${JSON.stringify(fixture)}`,
    }));
  }
  const statPrompts: string[] = [];
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', async (route) => {
    const body = route.request().postDataJSON();
    const system = body.messages.find((message: { role: string }) => message.role === 'system')?.content ?? '';
    const isStats = system.includes('stat tracker');
    if (isStats) statPrompts.push(system);
    const text = isStats ? 'Health: -25\nHealth: +20 MAX\nUnknown: -5' : 'You climb the wall and scrape your palm.';
    await route.fulfill({ contentType: 'text/event-stream', body:
      `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: [DONE]\n\n` });
  });
  await openApp(page, { FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions',
    'vite-ui-theme': theme,
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false },
  { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
  const mobile = (page.viewportSize()?.width ?? 1280) < 768;
  if (mobile) await page.getByRole('button', { name: 'Status', exact: true }).click();
  await expect(page.getByText('=c=Health==', { exact: true }).first()).toBeVisible();
  await page.waitForFunction(() => '__baseline' in window);
  await page.evaluate(() => (window as unknown as { __baseline: { runScript(actions: string[]): Promise<void> } }).__baseline.runScript(['Climb the wall.']));
  expect(statPrompts).toHaveLength(1);
  expect(statPrompts[0]).toContain('**Health:** 100/100');
  expect(statPrompts[0]).not.toContain('=c=Health==');
  await expect(page.getByText(/85\s*\/\s*120/).first()).toBeVisible();
  await expect(page.getByText('=g=Health==', { exact: true }).first()).toBeVisible();
  if (mobile) await page.getByRole('button', { name: 'Game', exact: true }).click();
  await page.getByRole('button', { name: 'More re-generate options', exact: true }).click();
  await page.getByRole('button', { name: 'Re-generate Stats', exact: true }).click();
  await expect.poll(() => statPrompts.length).toBe(2);
  await expect(page.getByRole('button', { name: 'More re-generate options', exact: true })).toBeEnabled();
  if (mobile) await page.getByRole('button', { name: 'Status', exact: true }).click();
  await expect(page.getByText(/85\s*\/\s*120/).first()).toBeVisible();
  expect(statPrompts[1]).toContain('**Health:** 85/120');
  await gotoDev(page, 'gameViewer', { modal: 'aiContext', fixture: 'whiteRoom' });
  await page.getByRole('button', { name: 'Collapse all', exact: true }).click();
  await page.getByRole('button', { name: 'Expand all', exact: true }).click();
  const diagnostic = page.getByText('Skipped stat updates: Unknown (unknown)', { exact: true }).last();
  await expect(diagnostic).toBeVisible();
  await diagnostic.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath(`stat-diagnostics-${theme}.png`), fullPage: true });
});
}
