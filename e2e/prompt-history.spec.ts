import { test, expect, type Locator, type Page } from '@playwright/test';
import { openApp, openPromptEditor, openWorldEditor, openWorldNarrationPrompt } from './app';

/**
 * Undo and redo in the prompt editor. These need a browser: Lexical's history keys off a real selection,
 * and jsdom has none — a programmatic edit there never enters the history stack, so the unit suite cannot
 * tell a working undo from a broken one.
 *
 * Both hosts run the same three checks. The Settings editor holds its value in a plain store; the world
 * editor writes every keystroke through to GameDataContext and hands the value straight back, and that
 * round-trip is the thing that can interfere with the history stack — so a guard on one is not a guard on
 * the other.
 */

const MARKER = 'ZZMARKER';

/** On a phone, tapping a prompt opens it full screen straight away, so the field being typed into is the
 *  overlay's rather than the inline one — that hand-off is its own spec's subject, and it would be the
 *  thing failing here rather than the history. Phone undo/redo stays uncovered. */
const PHONE_SKIP = 'phone opens the editor full screen on tap';

interface Surface {
  name: string;
  /** Open the host and return the one field under test. */
  open: (page: Page) => Promise<Locator>;
}

/** The prompt field owning this editor, so the buttons resolve on a page holding several fields. */
const fieldOf = (editor: Locator) => editor.locator('xpath=ancestor::div[contains(@class,"gap-2")][1]');

const SURFACES: Surface[] = [
  {
    name: 'settings',
    open: async (page) => {
      await openPromptEditor(page);
      return page.locator('[contenteditable="true"]').first();
    },
  },
  {
    // A markdown field: its toolbar owned the undo/redo buttons before they moved to the chrome row, so
    // it is the one surface where the move could have left them wired to nothing.
    name: 'world description',
    open: async (page) => {
      await openWorldEditor(page);
      return page.locator('[contenteditable="true"]').first();
    },
  },
  {
    name: 'world editor',
    open: async (page) => {
      await openWorldNarrationPrompt(page);
      return page.getByLabel('World narration prompt');
    },
  },
];

for (const surface of SURFACES) {
  test.describe(`undo and redo (${surface.name})`, () => {
    // Desktop only. On a phone, tapping a prompt opens it full screen straight away, so the field being
    // typed into is the overlay's rather than the inline one — that hand-off is its own spec's subject,
    // and it would be the thing failing here, not the history. Phone undo/redo is uncovered.

    /** Open the host, type the marker, and hand back the editor plus its two buttons. */
    const arrange = async (page: Page) => {
      await openApp(page);
      const editor = await surface.open(page);
      const field = fieldOf(editor);
      await editor.click();
      await page.keyboard.type(MARKER);
      await expect(editor).toContainText(MARKER);
      return {
        editor,
        undo: field.getByRole('button', { name: 'Undo' }),
        redo: field.getByRole('button', { name: 'Redo' }),
      };
    };

    test('undo takes back what was typed', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', PHONE_SKIP);
      const { editor, undo } = await arrange(page);

      await expect(undo).toBeEnabled();
      await undo.click();

      await expect(editor).not.toContainText(MARKER);
    });

    test('redo puts back what undo took, and the button says so', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', PHONE_SKIP);
      const { editor, undo, redo } = await arrange(page);
      await undo.click();
      await expect(editor).not.toContainText(MARKER);

      // The pair that was broken: after an undo BOTH buttons went dead, which is the history stacks being
      // cleared rather than redo alone failing.
      await expect(redo).toBeEnabled();
      await redo.click();
      await expect(editor).toContainText(MARKER);
    });

    test('the keyboard shortcuts do the same as the buttons', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', PHONE_SKIP);
      const { editor } = await arrange(page);

      await page.keyboard.press('Control+z');
      await expect(editor).not.toContainText(MARKER);

      await page.keyboard.press('Control+Shift+z');
      await expect(editor).toContainText(MARKER);
    });
  });
}
