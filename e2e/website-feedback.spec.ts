import { expect, test, type Page, type Request } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PAGES_URL } from '../playwright.config';
import { AGE_GATE_VERSION } from '../src/lib/ageGate';

/**
 * The formamorph.ai feedback board against controlled server answers: the warning gate, routing, the
 * not-found cases and the guest sign-in round trip.
 */

const FRAMES = '.scratch/frames';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

interface Row {
  id: string;
  type: 'bug' | 'suggestion' | 'question';
  title: string;
  status: string;
  votes: number;
  createdAt: string;
}

const day = (n: number) => `2026-0${1 + Math.floor(n / 28)}-${String(1 + (n % 28)).padStart(2, '0')}T00:00:00.000Z`;

// Fourteen suggestions: twelve still open, so the default view pages; two done, so a status filter shows more.
const SUGGESTIONS: Row[] = Array.from({ length: 14 }, (_, i) => ({
  id: id(i + 1),
  type: 'suggestion',
  title: `Suggestion ${String(i + 1).padStart(2, '0')}`,
  status: i >= 12 ? 'done' : 'open',
  votes: 100 - i,
  // Newest first is the board's default order, so Suggestion 01 leads page 1.
  createdAt: day(40 - i),
}));
const QUESTIONS: Row[] = [
  { id: id(51), type: 'question', title: 'How do saves work?', status: 'open', votes: 4, createdAt: day(3) },
  { id: id(52), type: 'question', title: 'Can I play offline?', status: 'open', votes: 2, createdAt: day(5) },
];
const BUG: Row = { id: id(90), type: 'bug', title: 'Secret crash', status: 'open', votes: 0, createdAt: day(1) };
const MISSING = id(99);
const ROWS = [...SUGGESTIONS, ...QUESTIONS, BUG];

const dto = (row: Row) => ({
  ...row,
  category: 'gameplay',
  body: `The full text of ${row.title}. `.repeat(row.id === SUGGESTIONS[0].id ? 40 : 1),
  reporter: { id: 'u2', username: 'rowan' },
  diagnostics: {},
  updatedAt: row.createdAt,
  locked: false,
  voted: false,
  unread: false,
  commentCount: 2,
});

const COMMENTS = [
  { id: 'c1', body: 'I would use this every day.', author: { id: 'u3', username: 'wren' }, createdAt: day(20) },
  { id: 'c2', body: 'Same here, especially on long trips.', author: { id: 'u4', username: 'sage' }, createdAt: day(21) },
];

/** Answer every API call the way the server would, and keep each feedback request for the assertions. */
async function serve(page: Page) {
  const feedback: Request[] = [];
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const signedIn = Boolean(request.headers().authorization);

    if (url.pathname.endsWith('/policies/age-gate')) {
      return route.fulfill({ json: { accepted: true, requiredVersion: AGE_GATE_VERSION } });
    }
    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({ json: { token: 'test-token', user: { id: 'u1', username: 'morgan' } } });
    }

    const thread = /\/feedback\/([^/]+)$/.exec(url.pathname)?.[1];
    if (url.pathname.endsWith('/feedback') || thread) feedback.push(request);

    if (thread) {
      const row = ROWS.find((candidate) => candidate.id === thread);
      // The server refuses a bug to a guest; a signed-in reader gets it, and the page must refuse it.
      if (!row || (row.type === 'bug' && !signedIn)) return route.fulfill({ status: 404, json: { error: 'Not found' } });
      return route.fulfill({ json: { data: dto(row), comments: COMMENTS } });
    }

    if (url.pathname.endsWith('/feedback')) {
      const params = url.searchParams;
      const statuses = params.get('status')?.split(',');
      const term = params.get('search')?.toLowerCase();
      let rows = ROWS.filter((row) => row.type === params.get('type'))
        .filter((row) => !statuses || statuses.includes(row.status))
        .filter((row) => !term || row.title.toLowerCase().includes(term));
      const sort = params.get('sort');
      rows = sort === 'votes' ? rows.sort((a, b) => b.votes - a.votes)
        : sort === 'oldest' ? rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          : rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const limit = Number(params.get('limit'));
      const pageNumber = Number(params.get('page'));
      return route.fulfill({
        json: { data: rows.slice((pageNumber - 1) * limit, pageNumber * limit).map(dto), total: rows.length },
      });
    }

    return route.fulfill({ json: { data: [] } });
  });
  return feedback;
}

/** A reader who already accepted the warning on this device, optionally signed in. */
async function prepare(page: Page, { signedIn = false } = {}) {
  await page.addInitScript(({ version, signedIn }) => {
    localStorage.setItem('vite-ui-theme', 'dark');
    localStorage.setItem('FORMAMORPH_ageGate', JSON.stringify({ accepted: true, acceptanceVersion: version, acceptedAt: new Date().toISOString() }));
    if (signedIn) {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('currentUser', JSON.stringify({ id: 'u1', username: 'morgan' }));
    }
  }, { version: AGE_GATE_VERSION, signedIn });
}

const rowTitles = (page: Page) =>
  page.locator('[role="tabpanel"][data-state="active"] button span.truncate').allTextContents();

const writes = (requests: Request[]) => requests.filter((request) => request.method() !== 'GET');

test.describe('website feedback board', () => {
  test('sends nothing before the warning is accepted, then reads both boards', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vite-ui-theme', 'dark'));
    const requests = await serve(page);

    await page.goto(`${PAGES_URL}/feedback`);
    await expect(page.getByRole('dialog')).toBeVisible();
    // Long enough for a mounted board to have asked; nothing may have.
    await page.waitForTimeout(500);
    expect(requests).toHaveLength(0);

    await page.getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByText('Suggestion 01')).toBeVisible();
    await expect(page.locator('header').getByRole('link', { name: 'Feedback', exact: true })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('tab', { name: 'Questions' }).click();
    await expect(page).toHaveURL(`${PAGES_URL}/feedback?board=questions`);
    await expect(page.getByText('How do saves work?')).toBeVisible();
    // A set: the dev server's StrictMode runs the first load's effect twice.
    expect(new Set(requests.map((request) => new URL(request.url()).searchParams.get('type'))))
      .toEqual(new Set(['suggestion', 'question']));
  });

  test('search, a filter, a sort and paging each change the list', async ({ page }) => {
    await prepare(page);
    await serve(page);
    await page.goto(`${PAGES_URL}/feedback`);
    await expect(page.getByText('Suggestion 01')).toBeVisible();
    const first = await rowTitles(page);
    expect(first).toHaveLength(10);

    await page.getByRole('button', { name: 'Next' }).click();
    await expect.poll(() => rowTitles(page)).toEqual(['Suggestion 11', 'Suggestion 12']);
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect.poll(() => rowTitles(page)).toEqual(first);

    await page.getByRole('button', { name: 'More Filters' }).click();
    await page.getByRole('combobox', { name: 'Filter by status' }).click();
    await page.getByRole('option', { name: 'All statuses' }).click();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await page.getByRole('combobox', { name: 'Sort by' }).click();
    await page.getByRole('option', { name: 'Oldest' }).click();
    await expect.poll(async () => (await rowTitles(page))[0]).toBe('Suggestion 14');
    await page.keyboard.press('Escape');

    await page.getByRole('searchbox').fill('Suggestion 13');
    await page.getByRole('searchbox').press('Enter');
    await expect.poll(() => rowTitles(page)).toEqual(['Suggestion 13']);
  });

  test('a thread has its own address, and Back and Forward move between it and the board', async ({ page }, testInfo) => {
    await prepare(page);
    await serve(page);

    await page.goto(`${PAGES_URL}/feedback/${SUGGESTIONS[1].id}`);
    await expect(page.getByRole('heading', { name: 'Suggestion 02' })).toBeVisible();
    await expect(page.getByText('Same here, especially on long trips.')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(`${PAGES_URL}/feedback`);

    await page.goto(`${PAGES_URL}/feedback?board=questions`);
    await page.getByText('How do saves work?').click();
    await expect(page).toHaveURL(`${PAGES_URL}/feedback/${QUESTIONS[0].id}`);
    await page.goBack();
    await expect(page).toHaveURL(`${PAGES_URL}/feedback?board=questions`);
    await expect(page.getByText('Can I play offline?')).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'How do saves work?' })).toBeVisible();

    await page.goto(`${PAGES_URL}/feedback`);
    await expect(page.getByText('Suggestion 01')).toBeVisible();
    const desktop = testInfo.project.name === 'desktop';
    mkdirSync(FRAMES, { recursive: true });
    if (desktop) await page.screenshot({ path: `${FRAMES}/feedback-board-desktop.png`, fullPage: true, animations: 'disabled' });
    await page.getByText('Suggestion 01').click();
    await expect(page.getByText('I would use this every day.')).toBeVisible();
    if (desktop) await page.screenshot({ path: `${FRAMES}/feedback-thread-desktop.png`, fullPage: true, animations: 'disabled' });
  });

  for (const signedIn of [false, true]) {
    test(`a bug, a missing and an invalid ID each show not-found ${signedIn ? 'when signed in' : 'for a guest'}`, async ({ page }) => {
      await prepare(page, { signedIn });
      await serve(page);

      for (const segment of [BUG.id, MISSING, 'not-a-thread']) {
        await page.goto(`${PAGES_URL}/feedback/${segment}`);
        await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
        await expect(page.getByText('Secret crash')).toHaveCount(0);
      }
    });
  }

  for (const control of ['Vote', 'New', 'Comment'] as const) {
    test(`${control} as a guest signs in and returns to the same place with nothing sent`, async ({ page }) => {
      await prepare(page);
      const requests = await serve(page);
      const start = control === 'Comment' ? `/feedback/${SUGGESTIONS[0].id}` : '/feedback';
      await page.goto(`${PAGES_URL}${start}`);

      if (control === 'Vote') await page.getByRole('button', { name: 'Vote for Suggestion 01' }).click();
      if (control === 'New') await page.getByRole('button', { name: 'Suggest Something' }).click();
      if (control === 'Comment') await page.getByRole('button', { name: 'Sign In to Reply' }).click();

      await expect(page).toHaveURL(`${PAGES_URL}/login?next=${encodeURIComponent(start)}`);
      await page.getByLabel('Username').fill('morgan');
      await page.getByLabel('Password').fill('test-password');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await expect(page).toHaveURL(`${PAGES_URL}${start}`);
      await expect(page.getByText(control === 'Comment' ? 'I would use this every day.' : 'Suggestion 01').first()).toBeVisible();
      await page.waitForTimeout(500);
      expect(writes(requests)).toEqual([]);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  }

  test('fits a phone, and the board is reachable by keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await prepare(page);
    await serve(page);
    await page.goto(`${PAGES_URL}/feedback`);
    await expect(page.getByText('Suggestion 01')).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    mkdirSync(FRAMES, { recursive: true });
    await page.screenshot({ path: `${FRAMES}/feedback-board-mobile.png`, fullPage: true, animations: 'disabled' });

    await page.getByRole('tab', { name: 'Suggestions' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(`${PAGES_URL}/feedback?board=questions`);
    await page.getByRole('button', { name: /^How do saves work\?/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${PAGES_URL}/feedback/${QUESTIONS[0].id}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
});
