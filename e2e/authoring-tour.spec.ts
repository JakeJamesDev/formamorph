import { expect, test, type Page } from '@playwright/test';
import { openApp } from './app';
import { AUTHORING_TOUR_OFFER_ID, AUTHORING_TOUR_SAVE_NOTE_ID, TUTORIALS } from '../src/lib/tutorials';
import { TOUR_STEPS, type TourStep } from '../src/lib/authoringTour/steps';

/**
 * The whole Authoring Tour as a new author takes it: New World, Start Tour, every step by its example, then
 * Play into the game. The one check that the tour still runs from start to finish after UI changes.
 */

const STEP_COUNT = TOUR_STEPS.length;
const TOUR_TABS = [...new Set(TOUR_STEPS.map((s) => s.tab).filter((t): t is NonNullable<TourStep['tab']> => !!t))];
// Add gives these items a default name, which counts as a value. Ticket 17 makes it stop counting.
const OPENS_WITH_DEFAULT_NAME = new Set(['location-name', 'entity-name', 'stat-name']);

/** Answers the game's model calls the way a model server would, so Play reaches the game view. */
async function mockModel(page: Page) {
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', (route) => route.fulfill({ contentType: 'text/event-stream', body:
    `data: ${JSON.stringify({ choices: [{ delta: { content: 'The tide turns.' }, finish_reason: null }] })}\n\ndata: [DONE]\n\n` }));
}

const editor = (page: Page) => page.getByRole('dialog', { name: 'World Editor' });
const stepNote = (page: Page, step: TourStep) => page.getByRole('dialog', { name: step.title, exact: true });
const inPlay = (page: Page) => page.getByRole('region', { name: 'In Play' });

const nextFrame = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(done)));

/** The trimmed, non-empty text of every editable field in the editor. */
const fieldValues = (page: Page) => editor(page).locator('input, textarea, [contenteditable="true"]')
  .evaluateAll((els) => els.map((el) => (
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : el.textContent ?? ''
  ).trim()).filter(Boolean));

/**
 * True when In Play marks, in full, a value a Use Example wrote. Any step's value, not only this one's: the
 * Locations step marks the entity's name. Reads a few frames, in case In Play commits after the field.
 */
async function marksExampleText(page: Page, written: ReadonlySet<string>): Promise<boolean> {
  for (let frame = 0; frame < 5; frame += 1) {
    const marks = await inPlay(page).locator('mark').allTextContents();
    if (marks.some((mark) => written.has(mark.trim()))) return true;
    await nextFrame(page);
  }
  return false;
}

test('a new author walks the whole tour by its examples and plays the world', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'In Play sits behind Show Effect on mobile; this walk reads it beside the editor');
  // A first-time author: the offer and the save note unseen, and the editor in its first-run Simple mode.
  const unseen = new Set([AUTHORING_TOUR_OFFER_ID, AUTHORING_TOUR_SAVE_NOTE_ID]);
  await mockModel(page);
  await openApp(page, {
    'formamorph.tutorialsSeen': TUTORIALS.map((t) => t.id).filter((id) => !unseen.has(id)),
    'formamorph.worldEditorMode': 'simple',
  });
  await page.getByText('Loaded default worlds').waitFor({ state: 'visible' });

  await page.getByRole('button', { name: 'New World' }).click();
  const offer = page.getByRole('dialog', { name: 'Take the Authoring Tour?' });
  await offer.getByRole('button', { name: 'Start Tour' }).click();

  const tourBar = editor(page).getByRole('region', { name: 'Authoring Tour' });
  const markedTabs = new Set<string>();
  // Every field value a Use Example wrote, so a default name or other prior text never counts as marked.
  const written = new Set<string>();

  for (const [index, step] of TOUR_STEPS.entries()) {
    const counter = `${index + 1} / ${STEP_COUNT}`;
    const note = stepNote(page, step);
    await expect(note).toBeVisible();
    await expect(note.getByText(counter, { exact: true })).toBeVisible();
    await expect(tourBar).toContainText(`Authoring Tour · ${counter}`);

    const last = index === STEP_COUNT - 1;
    const advance = note.getByRole('button', { name: last ? 'Finish' : 'Next', exact: true });

    if (step.add) {
      await expect(advance).toBeDisabled();
      await editor(page).locator(`[data-tour-anchor="${step.anchor}"]`).click();
    }
    if (step.useExample) {
      // An add step completes on its add, so only a field step waits for its example.
      if (OPENS_WITH_DEFAULT_NAME.has(step.id)) await expect(advance).toBeEnabled();
      else if (!step.add) await expect(advance).toBeDisabled();
      const before = new Set(await fieldValues(page));
      await note.getByRole('button', { name: 'Use Example' }).click();
      await nextFrame(page);
      for (const value of await fieldValues(page)) if (!before.has(value)) written.add(value);
    }
    await expect(advance).toBeEnabled();
    if (step.useExample && step.tab && !markedTabs.has(step.tab) && await marksExampleText(page, written)) {
      markedTabs.add(step.tab);
    }

    if (last) {
      await note.getByRole('button', { name: 'Play', exact: true }).click();
      break;
    }
    await advance.click();

    // The tour's first save raises its one-time Save note, which the step note waits behind.
    const saveNote = page.getByRole('dialog', { name: 'Your World Is Saved' });
    const nextNote = stepNote(page, TOUR_STEPS[index + 1]);
    await expect(saveNote.or(nextNote).first()).toBeVisible();
    if (await saveNote.isVisible()) await saveNote.getByRole('button', { name: 'Got It' }).click();
  }

  expect([...markedTabs].sort()).toEqual([...TOUR_TABS].sort());

  // Play enters through the main menu's own flow: the Introduction when the world has one, then setup.
  await expect(editor(page)).toBeHidden();
  const introduction = page.getByRole('dialog', { name: 'Introduction' });
  const setup = page.getByRole('dialog', { name: /^Enter / });
  await expect(introduction.or(setup).first()).toBeVisible();
  if (await introduction.isVisible()) await introduction.getByRole('button', { name: 'Close' }).click();
  await setup.getByRole('button', { name: 'Start game' }).click();
  await expect(setup).toBeHidden();

  await page.getByRole('tab', { name: 'Location', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Current Location: The Tidewell' })).toBeVisible();
});
