import { expect, test, type Page } from '@playwright/test';
import { AGE_GATE_VERSION } from '../src/lib/ageGate';
import { PAGES_URL } from '../playwright.config';
import { openApp } from './app';

const LISTING = {
  _id: 'handoff-world-1', id: 'handoff-world-1', kind: 'world',
  name: 'Handoff Sedge Landing', description: 'A world opened from the website.',
  author: { id: 'handoff-author', username: 'rowan' }, tags: [], likes: 0,
  updated_at: '2026-02-01T00:00:00.000Z',
};

async function stubCommunity(page: Page): Promise<void> {
  await page.route('**/worlds?*', (route) => route.fulfill({
    json: { success: true, data: [LISTING], total: 1 },
  }));
  await page.route('**/worlds/*/comments*', (route) => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('**/events/active', (route) => route.fulfill({ json: { data: [] } }));
  await page.route('**/events?*', (route) => route.fulfill({ json: { data: [] } }));
  await page.route('**/events', (route) => route.fulfill({ json: { data: [] } }));
}

test.describe('website creation handoff', () => {
  test('opens a deep-linked creation only after the browser-game warning is accepted', async ({ page }) => {
    await stubCommunity(page);
    await openApp(page, {
      FORMAMORPH_ageGate: { accepted: false, acceptanceVersion: AGE_GATE_VERSION, acceptedAt: null },
    }, {
      url: `${PAGES_URL}/play/?communityListingId=handoff-world-1&communityListingKind=world`,
    });

    await expect(page.getByRole('dialog', { name: 'Adult Content Ahead' })).toBeVisible();
    await expect(page.getByText('Handoff Sedge Landing')).toHaveCount(0);

    await page.getByRole('button', { name: 'Accept' }).click();

    await expect(page.getByRole('dialog').filter({ hasText: 'A world opened from the website.' })).toBeVisible();
    await expect(page).toHaveURL(`${PAGES_URL}/play/`);
  });

  test('follows Open in app from the website to the same browser-game creation', async ({ page }) => {
    await stubCommunity(page);
    await page.addInitScript(() => {
      localStorage.setItem('FORMAMORPH_introSeen', 'true');
      localStorage.setItem('FORMAMORPH_useCustomEndpoint', 'true');
      localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:9/v1/chat/completions');
      localStorage.setItem('FORMAMORPH_apiToken', 'e2e');
      localStorage.setItem('FORMAMORPH_modelName', 'e2e-model');
    });
    await page.goto(`${PAGES_URL}/community/world/handoff-world-1`);

    await page.getByRole('button', { name: 'Accept' }).click();
    await page.getByRole('link', { name: 'Open in app' }).click();

    await expect(page.getByRole('dialog').filter({ hasText: 'A world opened from the website.' })).toBeVisible();
    await expect(page).toHaveURL(`${PAGES_URL}/play/`);
  });
});
