import { expect, test, type Page, type Route } from '@playwright/test';
import { gotoDev, openApp, openPromptEditor } from './app';

/** A Tool defined in Settings reaches the model during play: its call runs, its result reaches the next
 *  round, and the narration lands. */

const TOOL_NAME = 'read_ledger';
const LEDGER = 'The ledger shows a debt of forty silver.';
const REPLY = 'The clerk taps the ledger twice.';
const GAME_URL = '/#dev?view=gameViewer&fixture=whiteRoom';

const SETTINGS = {
  FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false, FORMAMORPH_statUpdatesEnabled: false,
  FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
};

interface WireBody {
  stream?: boolean;
  tools?: { function: { name: string } }[];
  tool_choice?: string;
  messages: { role: string; content: string | null; tool_calls?: unknown[] }[];
}

const frame = (delta: object, finish: string | null = null) =>
  `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finish }] })}\n\n`;
const sse = (route: Route, frames: string[]) =>
  route.fulfill({ headers: { 'Content-Type': 'text/event-stream' }, body: `${frames.join('')}data: [DONE]\n\n` });

/**
 * An LM Studio server whose model is trained for tools. A request that offers Tools and has no result yet
 * gets a call; everything else gets prose. `hold` keeps the round after the call open until released.
 */
async function mockServer(page: Page) {
  const bodies: WireBody[] = [];
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  let holding = false;
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  // Registered after `**/v1/models`, so it wins for LM Studio's native list.
  await page.route('**/api/v1/models', (route) => route.fulfill({
    json: { models: [{ key: 'e2e-model', capabilities: { trained_for_tool_use: true } }] },
  }));
  await page.route('**/api/show', (route) => route.fulfill({ status: 404 }));
  await page.route('**/chat/completions', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as WireBody;
    if (body.stream === false) return route.fulfill({ json: { choices: [{ message: { content: 'ok' } }] } });
    bodies.push(body);
    const answered = body.messages.some((m) => m.role === 'tool');
    if (body.tools && !answered) {
      return sse(route, [
        frame({ tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name: TOOL_NAME, arguments: '{"who":"me"}' } }] }),
        frame({}, 'tool_calls'),
      ]);
    }
    if (answered && holding) await held;
    // A stopped turn aborts the held request before it is answered.
    return sse(route, [frame({ content: REPLY }), frame({}, 'stop')]).catch(() => {});
  });
  return { bodies, hold: () => { holding = true; }, release: () => release() };
}

/** Play waits for the tools answer: until it lands, no Tools are sent. */
async function toolsKnown(page: Page) {
  await expect.poll(() => page.evaluate(() => localStorage.getItem('FORMAMORPH_reasoningSupport') ?? ''))
    .toContain('"tools":true');
}

async function act(page: Page, action: string) {
  await page.getByPlaceholder(/Type your action/).fill(action);
  await page.getByRole('button', { name: 'Send' }).click();
}

const toolMessages = (body: WireBody) => body.messages.filter((m) => m.role === 'tool');

test('a Tool defined in Settings is called during play, and AI Context shows its round', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const server = await mockServer(page);
  await openApp(page, { ...SETTINGS, FORMAMORPH_showSilentRequests: true });

  // Define the Tool in an editable preset.
  await openPromptEditor(page);
  await gotoDev(page, 'mainMenu', { modal: 'settings', tab: 'tools' });
  await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'New Tool' }).click();
  await page.getByRole('tabpanel').getByRole('textbox', { name: 'Name' }).first().fill(TOOL_NAME);
  await page.getByRole('button', { name: 'Add Outline' }).click();
  await page.getByRole('tab', { name: 'Parameters' }).click();
  await page.getByRole('button', { name: 'Add Parameter' }).click();
  await page.getByRole('group', { name: 'Parameter 1' }).getByRole('textbox', { name: 'Name' }).fill('who');
  await page.getByRole('tab', { name: 'Handler' }).click();
  // Radios on a wide screen, a dropdown on a narrow one.
  const templateRadio = page.getByRole('radio', { name: 'Template' });
  const kindMenu = page.getByRole('combobox', { name: 'Handler' });
  await expect(templateRadio.or(kindMenu)).toBeVisible();
  if (await templateRadio.isVisible()) {
    await templateRadio.click();
  } else {
    await kindMenu.click();
    await page.getByRole('option', { name: 'Template' }).click();
  }
  await page.getByRole('textbox', { name: 'Template' }).click();
  await page.keyboard.type(LEDGER);
  // A narrow screen edits the field full screen.
  const exitFullScreen = page.getByRole('button', { name: 'Exit full screen' });
  if (await exitFullScreen.isVisible()) await exitFullScreen.click();
  await page.getByRole('button', { name: 'Save Tool' }).click();
  await expect(page.getByRole('heading', { level: 3, name: TOOL_NAME })).toBeVisible();

  await page.goto(GAME_URL);
  await page.waitForFunction(() => '__fmDev' in window);
  await toolsKnown(page);

  server.hold();
  await act(page, 'I ask the clerk what I owe.');
  // Between the call and the reply, the silent status line names the lookup.
  await expect(page.getByText('Looking up…')).toBeVisible();
  server.release();
  await expect(page.getByText(REPLY).last()).toBeVisible();
  await expect(page.getByText('Looking up…')).toHaveCount(0);

  const [first, second] = server.bodies;
  expect(first.tools?.map((t) => t.function.name)).toEqual([TOOL_NAME]);
  expect(first.tool_choice).toBe('auto');
  // The Tool's result reached the next round.
  expect(toolMessages(second).map((m) => m.content)).toEqual([LEDGER]);

  await gotoDev(page, 'gameViewer', { modal: 'aiContext' });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Tool Rounds' })).toBeVisible();
  const round = dialog.getByRole('group', { name: 'Tool Round 1' });
  await expect(round.getByText(TOOL_NAME)).toBeVisible();
  await expect(round.getByTestId('tool-call-result')).toHaveText(LEDGER);
  await expect(round.getByTestId('tool-call-arguments').locator('.tok-string').first()).toHaveText('"me"');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await gotoDev(page, 'gameViewer');

  // The next turn's history holds the narration, not the round that fetched it.
  const sent = server.bodies.length;
  await act(page, 'I pay the clerk.');
  // The narration's call round, then its reply round.
  await expect.poll(() => server.bodies.length).toBe(sent + 2);
  await expect(page.getByText(REPLY).last()).toBeVisible();
  const next = server.bodies[sent];
  expect(next.messages.some((m) => m.content?.includes(REPLY))).toBe(true);
  expect(toolMessages(next)).toEqual([]);
  expect(next.messages.some((m) => m.tool_calls)).toBe(false);
  expect(next.messages.some((m) => m.content?.includes(LEDGER))).toBe(false);
});

test('with Show Silent Requests off, a Tool round stays out of sight, and Stop ends it', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const server = await mockServer(page);
  const tool = {
    id: 'ledger', name: TOOL_NAME, description: 'Purpose: read the ledger.',
    params: [{ name: 'who', type: 'string', description: '', required: true, options: [] }],
    handler: { kind: 'template', body: LEDGER }, emptyResult: '', offeredTo: ['narration'], enabled: true,
  };
  await openApp(page, {
    ...SETTINGS,
    FORMAMORPH_showSilentRequests: false,
    FORMAMORPH_promptPresets: { activeId: 'mine', presets: [{ id: 'mine', name: 'Mine', values: {}, style: 'markdown', tools: [tool] }] },
  }, { url: GAME_URL });
  await toolsKnown(page);

  server.hold();
  await act(page, 'I ask the clerk what I owe.');
  await expect.poll(() => server.bodies.length).toBe(2);
  await expect(page.getByText('Generating Narration…')).toBeVisible();
  await expect(page.getByText('Looking up…')).toHaveCount(0);

  await page.getByRole('button', { name: 'Stop generating' }).click();
  await expect(page.getByPlaceholder(/Type your action/)).toBeEnabled();
  server.release();
  // Stop sends no further round, and nothing from the stopped turn lands.
  await expect(page.getByText(REPLY)).toHaveCount(0);
  expect(server.bodies).toHaveLength(2);

  // The next turn plays normally.
  await act(page, 'I ask again.');
  await expect(page.getByText(REPLY).last()).toBeVisible();

  await gotoDev(page, 'gameViewer', { modal: 'aiContext' });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Request 1/).first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Tool Rounds' })).toHaveCount(0);
  await expect(dialog.getByText(TOOL_NAME)).toHaveCount(0);
});
