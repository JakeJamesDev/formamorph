import { expect, test } from '@playwright/test';
import { openApp } from './app';

/**
 * The event poster closes only through its own buttons, so they must stay on screen however long the
 * body runs and however large the system font is. Served with a body the length of a real contest
 * opening, on a short phone viewport with the root font scaled the way Android's text size setting
 * scales a page.
 */
const LONG_BODY = Array.from({ length: 4 }, (_, i) =>
  `Paragraph ${i + 1}. Show off your authoring skills with the community with a themed world to earn a `
  + 'permanent badge. Create something truly unique to go along with the experience the season brings, '
  + 'and update your entry at any time up until the deadline.').join('\n\n');

const activeEvent = () => {
  const now = Date.now();
  return {
    id: 'e2e-poster-fit',
    type: 'contest',
    state: 'active',
    title: 'A Contest With A Long Poster',
    bannerText: 'A contest with a long poster',
    body: LONG_BODY,
    rulesText: 'One entry per creator.',
    posterColor: '#1e3a8a',
    posterImageUrl: null,
    posterPlacement: null,
    startsAt: new Date(now - 86_400_000).toISOString(),
    endsAt: new Date(now + 86_400_000 * 12).toISOString(),
    cancelledAt: null,
    startMessageId: null,
    endMessageId: null,
    resultsMessageId: null,
    resultsAnnouncedAt: null,
    placements: [],
  };
};

test.use({ viewport: { width: 360, height: 600 } });

test('the poster keeps Got It on screen with a long body and large text', async ({ page }) => {
  await page.route('**/events/active*', (route) => route.fulfill({ json: { success: true, count: 1, data: [activeEvent()] } }));
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '20.8px'; });
  });
  await openApp(page, {}, { liveEvents: true });

  const dialog = page.getByRole('dialog', { name: 'A Contest With A Long Poster' });
  await expect(dialog).toBeVisible();

  const body = dialog.getByTestId('event-ack-body');
  const gotIt = dialog.getByRole('button', { name: 'Got It' });

  // The prose overflows and scrolls; the dialog stays inside the viewport with the button in reach.
  const measured = await page.evaluate(([b, d]) => {
    const bodyEl = document.querySelector<HTMLElement>(`[data-testid="${b}"]`)!;
    const dialogEl = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const btn = [...dialogEl.querySelectorAll('button')].find((x) => x.textContent?.trim() === d)!;
    const dr = dialogEl.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    return {
      bodyScrolls: bodyEl.scrollHeight > bodyEl.clientHeight,
      dialogTop: dr.top, dialogBottom: dr.bottom,
      buttonTop: br.top, buttonBottom: br.bottom,
      vh: window.innerHeight,
    };
  }, ['event-ack-body', 'Got It'] as const);

  expect(measured.buttonTop).toBeGreaterThanOrEqual(0);
  expect(measured.buttonBottom).toBeLessThanOrEqual(measured.vh);
  expect(measured.dialogTop).toBeGreaterThanOrEqual(0);
  expect(measured.dialogBottom).toBeLessThanOrEqual(measured.vh);
  expect(measured.bodyScrolls).toBe(true);
  await expect(body).toBeVisible();

  // A real tap, not a synthetic click: the button has to be the thing under the pointer.
  await gotIt.click();
  await expect(dialog).toBeHidden();
});
