import { expect, test, type Page, type Request } from '@playwright/test';
import { PAGES_URL } from '../playwright.config';
import { AGE_GATE_VERSION } from '../src/lib/ageGate';

/** A signed-in reader's vote, comments and own-post edits on formamorph.ai/feedback against controlled server answers. */

const THREAD = '00000000-0000-4000-8000-000000000001';
const ME = { id: 'u1', username: 'morgan' };

interface Comment { id: string; body: string; author: { id: string; username: string }; createdAt: string; editedAt: string | null }

/** A server with one suggestion the reader filed, and one comment each from the reader and somebody else. */
async function serve(page: Page, { failVote = false } = {}) {
  const thread = {
    id: THREAD, number: 1, type: 'suggestion', title: 'Add a map', category: 'gameplay', body: 'A map of the places I went.',
    status: 'open', votes: 3, voted: false, unread: false, locked: false, commentCount: 2, diagnostics: {},
    reporter: ME, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', editedAt: null as string | null,
  };
  let comments: Comment[] = [
    { id: 'c1', body: 'Mine from before.', author: ME, createdAt: '2026-01-02T00:00:00.000Z', editedAt: null },
    { id: 'c2', body: 'From somebody else.', author: { id: 'u2', username: 'rowan' }, createdAt: '2026-01-03T00:00:00.000Z', editedAt: null },
  ];
  const writes: Request[] = [];

  await page.route('**/api/**', (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const body = request.postDataJSON() as Record<string, unknown> | null;

    if (pathname.endsWith('/policies/age-gate')) return route.fulfill({ json: { accepted: true, requiredVersion: AGE_GATE_VERSION } });
    if (!pathname.includes('/feedback')) return route.fulfill({ json: { data: [] } });
    if (request.method() === 'GET') {
      return pathname.endsWith('/feedback')
        ? route.fulfill({ json: { data: [thread], total: 1 } })
        : route.fulfill({ json: { data: thread, comments } });
    }

    writes.push(request);
    if (pathname.endsWith('/vote')) {
      if (failVote) return route.fulfill({ status: 500, json: { error: 'down' } });
      thread.voted = Boolean(body?.voted);
      thread.votes += thread.voted ? 1 : -1;
      return route.fulfill({ json: { data: thread } });
    }
    if (pathname.endsWith('/comments')) {
      const added = { id: `c${comments.length + 1}`, body: String(body?.body), author: ME, createdAt: '2026-01-04T00:00:00.000Z', editedAt: null };
      comments = [...comments, added];
      return route.fulfill({ json: { data: added } });
    }
    if (pathname.includes('/comments/')) {
      const id = pathname.split('/').pop();
      if (request.method() === 'DELETE') {
        comments = comments.filter((comment) => comment.id !== id);
        return route.fulfill({ json: {} });
      }
      comments = comments.map((comment) => (comment.id === id ? { ...comment, body: String(body?.body), editedAt: '2026-01-05T00:00:00.000Z' } : comment));
      return route.fulfill({ json: { data: comments.find((comment) => comment.id === id) } });
    }
    Object.assign(thread, body, { editedAt: '2026-01-05T00:00:00.000Z' });
    return route.fulfill({ json: { data: thread } });
  });
  return writes;
}

async function signedIn(page: Page) {
  await page.addInitScript(({ version, user }) => {
    localStorage.setItem('vite-ui-theme', 'dark');
    localStorage.setItem('FORMAMORPH_ageGate', JSON.stringify({ accepted: true, acceptanceVersion: version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('currentUser', JSON.stringify(user));
  }, { version: AGE_GATE_VERSION, user: ME });
}

const sentLines = (writes: Request[]) => writes.map((request) => `${request.method()} ${new URL(request.url()).pathname.replace(/^.*\/feedback/, '')}`);

test.describe('website feedback writes', () => {
  test('votes and unvotes, comments, and edits and deletes own posts', async ({ page }) => {
    await signedIn(page);
    const writes = await serve(page);
    await page.goto(`${PAGES_URL}/feedback/1`);

    const vote = page.getByRole('button', { name: /^(Vote|Voted) · / });
    await expect(vote).toHaveText('Vote · 3');
    await vote.click();
    await expect(vote).toHaveText('Voted · 4');
    await expect(vote).toHaveAttribute('aria-pressed', 'true');
    await vote.click();
    await expect(vote).toHaveText('Vote · 3');

    await page.getByLabel('Reply', { exact: true }).fill('A fresh comment.');
    await page.getByRole('button', { name: 'Send Reply' }).click();
    await expect(page.getByText('A fresh comment.')).toBeVisible();

    // Only the reader's own comments carry controls: c1 and the new one, not rowan's.
    await expect(page.getByRole('button', { name: 'Edit comment' })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Delete comment' })).toHaveCount(2);
    await page.getByRole('button', { name: 'Edit comment' }).first().click();
    await page.getByLabel('Comment text').fill('Mine, reworded.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Mine, reworded.')).toBeVisible();

    await page.getByRole('button', { name: 'Delete comment' }).first().click();
    expect(sentLines(writes)).not.toContain('DELETE /' + THREAD + '/comments/c1');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Mine, reworded.')).toHaveCount(0);

    await page.getByRole('button', { name: /Edit this report/ }).click();
    await page.getByLabel('Title').fill('Add a world map');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.getByRole('heading', { name: /Add a world map/ })).toBeVisible();

    expect(sentLines(writes)).toEqual([
      `PUT /${THREAD}/vote`, `PUT /${THREAD}/vote`, `POST /${THREAD}/comments`,
      `PUT /${THREAD}/comments/c1`, `DELETE /${THREAD}/comments/c1`, `PUT /${THREAD}`,
    ]);
  });

  test('says a failed vote under the button and leaves the count alone', async ({ page }) => {
    await signedIn(page);
    await serve(page, { failVote: true });
    await page.goto(`${PAGES_URL}/feedback/1`);

    const vote = page.getByRole('button', { name: /^Vote · 3/ });
    await vote.click();

    await expect(page.getByRole('alert')).toHaveText('Failed to record your vote');
    await expect(vote).toHaveAttribute('aria-pressed', 'false');
    await expect(vote).toHaveText('Vote · 3');
  });

  test('moves to the guest view when another tab signs out, and Vote then goes to sign-in', async ({ page, context }) => {
    await signedIn(page);
    await serve(page);
    await page.goto(`${PAGES_URL}/feedback/1`);
    await expect(page.getByLabel('Reply', { exact: true })).toBeVisible();

    const other = await context.newPage();
    await other.goto(`${PAGES_URL}/feedback`);
    await other.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
    });

    await expect(page.getByRole('button', { name: 'Sign In to Reply' })).toBeVisible();
    await expect(page.getByLabel('Reply', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /^Vote · 3/ }).click();
    await expect(page).toHaveURL(`${PAGES_URL}/login?next=${encodeURIComponent('/feedback/1')}`);
  });
});
