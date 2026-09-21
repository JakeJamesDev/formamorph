import { expect, test } from '@playwright/test';
import { gotoDev, openApp } from './app';

test('JSON cards keep linked portraits and editable library-only tags', async ({ page }) => {
  await openApp(page, { FORMAMORPH_layoutMode_entities: 'detailed' });
  await gotoDev(page, 'mainMenu', { tab: 'entities' });
  await page.route('https://example.com/guide.png', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="blue"/></svg>',
  }));
  await page.locator('input[type=file][accept*="image/jpeg"]').setInputFiles({
    name: 'guide.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
      spec: 'chara_card_v2', spec_version: '2.0', data: {
        name: 'Marsh Guide', description: 'A guide at the landing.', first_mes: 'Welcome to the landing.',
        creator: 'Rowan', tags: ['Guide', 'River'], avatar: 'https://example.com/guide.png',
      },
    })),
  });
  const card = page.locator('[data-tile-id]').filter({ hasText: 'Marsh Guide' });
  await expect(card).toBeVisible();
  await expect(card.getByText('By Rowan', { exact: true })).toBeVisible();
  await card.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Remove Guide', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Remove Guide', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  const records = await page.evaluate(async () => {
    const modulePath = '/src/services/EntityStorageService.ts';
    const store = await import(/* @vite-ignore */ modulePath);
    const metadata = await store.default.getEntityMetadata();
    const record = metadata.find((item: { name: string }) => item.name === 'Marsh Guide');
    return { metadata: record, entity: await store.default.getEntityData(record.id) };
  });
  expect(records.metadata.libraryDetails).toEqual({ author: 'Rowan', tags: ['River'] });
  expect(records.entity.tags).toBeUndefined();
  expect(records.entity.images).toEqual(['https://example.com/guide.png']);
  await page.screenshot({ path: test.info().outputPath('imported-library-entity.png') });
});
