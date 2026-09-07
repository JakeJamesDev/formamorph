import { expect, test } from '@playwright/test';
import { PAGES_URL, SITE_URL } from '../playwright.config';
import { AGE_GATE_VERSION } from '../src/lib/ageGate';

for (const theme of ['light', 'dark']) {
  test(`website likes render hover and filled colors in ${theme}`, async ({ page }, testInfo) => {
    await page.addInitScript(({ theme, version }) => {
      localStorage.setItem('vite-ui-theme', theme);
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('currentUser', JSON.stringify({ id: 'reader', username: 'morgan', ageGateAcceptedVersion: version }));
      localStorage.setItem('FORMAMORPH_ageGate', JSON.stringify({ accepted: true, acceptanceVersion: version, acceptedAt: new Date().toISOString() }));
    }, { theme, version: AGE_GATE_VERSION });
    await page.route('**/api/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/policies/age-gate')) return route.fulfill({ json: { accepted: true, requiredVersion: AGE_GATE_VERSION } });
      if (url.pathname.endsWith('/like')) return route.fulfill({ json: { data: { liked: true, likes: 1 } } });
      if (url.pathname.endsWith('/worlds')) return route.fulfill({ json: { success: true, total: 2, data: [{
        _id: 'navigation-world', id: 'navigation-world', kind: 'world', name: 'Sedge Landing',
        author: { id: 'author', username: 'rowan' }, tags: [], likes: 0,
        description: 'A quiet harbor.', updated_at: '2026-02-01T00:00:00.000Z',
      }, {
        _id: 'popular-world', id: 'popular-world', kind: 'world', name: 'Old Harbor',
        author: { id: 'author', username: 'rowan' }, tags: [], likes: 25,
        description: 'A community favorite.', updated_at: '2025-01-01T00:00:00.000Z',
      }] } });
      return route.fulfill({ json: { data: [] } });
    });
    await page.goto(`${PAGES_URL}/community`);
    const like = page.getByRole('button', { name: 'Like — 0 likes' });
    await expect(like).toBeVisible();
    const filters = page.getByRole('button', { name: 'Filters', exact: true });
    const mobileFilters = await filters.isVisible();
    if (mobileFilters) await filters.click();
    await expect(page.getByRole('combobox').filter({ hasText: 'Likes' })).toBeVisible();
    if (mobileFilters) await filters.click();
    const counts = await page.getByRole('button', { name: /^Like —/ }).allTextContents();
    expect(counts.map(text => text.trim())).toEqual(['25', '0']);
    await like.hover();
    await expect(like).toHaveCSS('color', 'rgb(226, 54, 112)');
    await like.click();
    const heart = page.getByRole('button', { name: 'Unlike — 1 like' }).locator('svg');
    await expect(heart).toHaveCSS('fill', 'rgb(226, 54, 112)');
    await expect(heart).toHaveCSS('color', 'rgb(226, 54, 112)');
    await expect(page.getByRole('link', { name: 'Community', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.screenshot({ path: testInfo.outputPath('community-liked.png') });
  });
}

for (const url of [SITE_URL, `${SITE_URL}/privacy`, `${PAGES_URL}/login`]) {
  for (const theme of ['light', 'dark']) {
  test(`avatar menu and left navigation at ${url} in ${theme}`, async ({ page }, testInfo) => {
    await page.addInitScript((theme) => {
      localStorage.setItem('vite-ui-theme', theme);
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('currentUser', JSON.stringify({ username: 'rowan' }));
    }, theme);
    await page.goto(url);
    const avatar = page.getByRole('button', { name: 'Account menu' });
    const community = page.getByRole('link', { name: 'Community', exact: true });
    await expect(avatar).toBeVisible();
    await expect(page.locator('.fm-site-header')).toHaveCSS('height', '64px');
    expect(Math.abs((await community.boundingBox())!.y - 16)).toBeLessThan(1);
    expect((await community.boundingBox())!.x).toBeLessThan((await avatar.boundingBox())!.x);
    expect((await community.boundingBox())!.x).toBeLessThan(page.viewportSize()!.width / 2);
    await expect(page.getByRole('link', { name: 'Account Settings' })).toBeHidden();
    await avatar.click();
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toHaveAttribute('href', '/u/rowan');
    await expect(page.getByRole('link', { name: 'Account Settings' })).toHaveAttribute('href', '/account');
    await expect(page.locator('.fm-account-menu')).toHaveCSS('width', '280px');
    await expect(page.locator('.fm-account-menu')).toHaveCSS('font-size', '14px');
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toHaveCSS('font-weight', '500');
    await expect(page.locator('.fm-account-menu')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(39, 43, 46)' : 'rgb(238, 241, 237)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('account-menu.png'), animations: 'disabled' });
    const otherTheme = theme === 'light' ? 'Dark' : 'Light';
    await page.getByRole('button', { name: otherTheme, exact: true }).click();
    await expect(page.locator('html')).toHaveClass(otherTheme.toLowerCase());
    await expect(page.getByRole('button', { name: otherTheme, exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('vite-ui-theme'))).toBe(otherTheme.toLowerCase());
    await expect(page.getByRole('link', { name: 'Account Settings' })).toBeVisible();
    await page.getByRole('button', { name: 'System', exact: true }).click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass('dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveClass('light');
    await expect(page.getByRole('button', { name: 'System', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('vite-ui-theme'))).toBe('system');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('link', { name: 'Account Settings' })).toBeHidden();
    await expect(avatar).toBeFocused();
    await avatar.click();
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Sign In', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
  });
  }
}
