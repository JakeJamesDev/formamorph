import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './app';

/** Serve the whiteRoom world and save with Coin (60 of 100 in the save) carrying `code` and the `stat` fields,
 *  regen 0 unless given. `extra` is laid over the root of each fixture. */
async function coinWithCode(
  page: Page, code: string, stat: { regen?: number; min?: number; name?: string; beforeCode?: string } = {},
  extra: { World?: object; Save?: object } = {},
) {
  for (const kind of ['World', 'Save'] as const) {
    const fixture = { ...JSON.parse(readFileSync(`src/lib/devFixtures/whiteRoom${kind}.json`, 'utf8')), ...extra[kind] };
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if ('id' in value && value.id === 'stat-coin' && 'name' in value) Object.assign(value, { code, regen: 0, ...stat });
      Object.values(value).forEach(visit);
    };
    visit(fixture);
    await page.route(`**/whiteRoom${kind}.json*`, (route) => route.fulfill({
      contentType: 'application/javascript', body: `export default ${JSON.stringify(fixture)}`,
    }));
  }
}

/** Answer every chat call: the stat tracker gets `statReply`, narration gets a line of prose. Each
 *  narration request's messages land in `narration`, and each stat request's in `statPrompts`, when given. */
async function mockModel(page: Page, statReply: string, narration?: string[], statPrompts?: string[]) {
  let statCalls = 0;
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', async (route) => {
    const { messages } = route.request().postDataJSON();
    const system = messages.find((message: { role: string }) => message.role === 'system')?.content ?? '';
    const isStats = system.includes('stat tracker');
    if (isStats) {
      statCalls += 1;
      statPrompts?.push(JSON.stringify(messages));
    } else narration?.push(JSON.stringify(messages));
    const text = isStats ? statReply : 'You count the coins twice.';
    await route.fulfill({ contentType: 'text/event-stream', body:
      `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: [DONE]\n\n` });
  });
  return () => statCalls;
}

const settings = (extra: Record<string, unknown> = {}) => ({
  FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions',
  FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
  FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
  ...extra,
});

async function playOneTurn(page: Page, actions = ['Count the coins.']) {
  const mobile = (page.viewportSize()?.width ?? 1280) < 768;
  if (mobile) await page.getByRole('button', { name: 'Status', exact: true }).click();
  await expect(page.getByText(/60\s*\/\s*100/).first()).toBeVisible();
  await page.waitForFunction(() => '__baseline' in window);
  await page.evaluate((script) => (window as unknown as { __baseline: { runScript(actions: string[]): Promise<void> } })
    .__baseline.runScript(script), actions);
  return mobile;
}

const mood = { id: 'ph-mood', name: 'Mood', values: [{ id: 'v-calm', text: 'calm' }, { id: 'v-angry', text: 'angry' }] };
const calmRoll = { placeholderRolls: { world: { 'ph-mood': 'calm' } } };

test('stat code halves an AI gain, and a stats re-roll lands the same value', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'self.value = self.previous.value + self.delta.ai.value / 2;');
  const statCalls = await mockModel(page, 'Coin: +20');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  const mobile = await playOneTurn(page);

  // The AI asked +20 onto 60; the code keeps half of it.
  await expect(page.getByText(/70\s*\/\s*100/).first()).toBeVisible();

  if (mobile) await page.getByRole('button', { name: 'Game', exact: true }).click();
  await page.getByRole('button', { name: 'More re-generate options', exact: true }).click();
  await page.getByRole('button', { name: 'Re-generate Stats', exact: true }).click();
  await expect.poll(statCalls).toBe(2);
  await expect(page.getByRole('button', { name: 'More re-generate options', exact: true })).toBeEnabled();
  if (mobile) await page.getByRole('button', { name: 'Status', exact: true }).click();
  // From the same pre-turn 60, not from the 70 the first run left.
  await expect(page.getByText(/70\s*\/\s*100/).first()).toBeVisible();
  await expect(page.getByText(/(80|75)\s*\/\s*100/)).toHaveCount(0);
});

test('stat code reads the value after this turn’s regen, and the regen it applied', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'self.value = self.value + self.delta.regen.value;', { regen: 5 });
  await mockModel(page, 'Coin: +20');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  // 60 + 20 asked + 5 regen = 85 is what code reads; it adds the regen once more.
  await expect(page.getByText(/90\s*\/\s*100/).first()).toBeVisible();
});

test('stat code reads the AI ask from delta.ai and the turn-start min from previous', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'return self.previous.value + self.delta.ai.value / 2 + self.previous.min * 2;', { min: 10 });
  await mockModel(page, 'Coin: +20');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  // 60 + 20 / 2 + 10 * 2 = 90; the AI alone would leave 80.
  await expect(page.getByText(/90\s*\/\s*100/).first()).toBeVisible();
});

test('stat code sets its value from the playthrough’s roll of a placeholder', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'return { calm: 11, angry: 22 }[placeholders.Mood.value];', {}, {
    World: { placeholders: [mood] },
    Save: { placeholderRolls: { world: { 'ph-mood': 'angry' } } },
  });
  await mockModel(page, 'Coin: +20');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  await expect(page.getByText(/22\s*\/\s*100/).first()).toBeVisible();
});

// Coin renamed to a chip plus a word: the panel reads "calm Coin" or "angry Coin", and code reaches it by
// "Mood Coin" in both. The lookup is the whole test: a blank entry would leave 1, not 61. The stat request
// is off, so the turn makes no stat call at all, and the code still runs and still reads the clock.
for (const [rolled, shown] of [['calm', 'calm Coin'], ['angry', 'angry Coin']] as const) {
  test(`stat code reads a chip-bearing stat name by its code name, on the ${rolled} roll`, async ({ page }) => {
    page.on('pageerror', (error) => console.error(error.message));
    await coinWithCode(page, 'return stats["Mood Coin"].value + deltaHours;', { name: '{{ph:ph-mood:world:p9}} Coin' }, {
      World: { placeholders: [mood] },
      Save: { placeholderRolls: { world: { 'ph-mood': rolled } } },
    });
    await mockModel(page, 'Coin: +0');
    await openApp(page, settings({ FORMAMORPH_statUpdatesEnabled: false }), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
    await playOneTurn(page);

    await expect(page.getByText(shown).first()).toBeVisible();
    await expect(page.getByText(/61\s*\/\s*100/).first()).toBeVisible();
  });
}

test('a placeholder that stat code writes reaches the next turn’s prompt', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const world = JSON.parse(readFileSync('src/lib/devFixtures/whiteRoomWorld.json', 'utf8'));
  const locations = world.locations.map((location: { id: string }) => (location.id === '1783535114538'
    ? { ...location, aiDescription: 'The walls glow {{ph:ph-mood:world:p1}}.' } : location));
  await coinWithCode(page, 'placeholders.Mood.value = "incandescent";', {}, {
    World: { placeholders: [mood], locations }, Save: calmRoll,
  });
  const narration: string[] = [];
  await mockModel(page, 'Coin: +20', narration);
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page, ['Count the coins.', 'Count them again.']);

  await expect.poll(() => narration.length).toBeGreaterThanOrEqual(2);
  expect(narration[0]).toContain('The walls glow calm.');
  expect(narration[narration.length - 1]).toContain('The walls glow incandescent.');
});

// An Object shows every value at once, so code pins it with a list and the prompt reads that list joined.
test('an Object pinned to a list from code reaches the next turn’s prompt as one joined text', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const hair = {
    id: 'ph-hair', name: 'Hair', roll: false,
    values: [{ id: 'v-grey', text: 'grey' }, { id: 'v-long', text: 'long' }],
  };
  const world = JSON.parse(readFileSync('src/lib/devFixtures/whiteRoomWorld.json', 'utf8'));
  const locations = world.locations.map((location: { id: string }) => (location.id === '1783535114538'
    ? { ...location, aiDescription: 'Her hair is {{ph:ph-hair:world:p2}}.' } : location));
  await coinWithCode(page, 'placeholders.Hair.pin(["silver", "cropped short"]);', {}, {
    World: { placeholders: [hair], locations },
  });
  const narration: string[] = [];
  await mockModel(page, 'Coin: +20', narration);
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page, ['Count the coins.', 'Count them again.']);

  await expect.poll(() => narration.length).toBeGreaterThanOrEqual(2);
  // Unpinned the Object joins its own values; pinned it joins the list code handed it.
  expect(narration[0]).toContain('Her hair is grey, long.');
  expect(narration[narration.length - 1]).toContain('Her hair is silver, cropped short.');
});

test('a stats re-roll reads the pre-turn Code Pins, so a flip lands once', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const flip = 'const next = placeholders.Mood.value === "calm" ? "angry" : "calm";\n'
    + 'placeholders.Mood.value = next;\nreturn { calm: 11, angry: 22 }[next];';
  await coinWithCode(page, flip, {}, { World: { placeholders: [mood] }, Save: calmRoll });
  const statCalls = await mockModel(page, 'Coin: +20');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  const mobile = await playOneTurn(page);

  await expect(page.getByText(/22\s*\/\s*100/).first()).toBeVisible();

  if (mobile) await page.getByRole('button', { name: 'Game', exact: true }).click();
  await page.getByRole('button', { name: 'More re-generate options', exact: true }).click();
  await page.getByRole('button', { name: 'Re-generate Stats', exact: true }).click();
  await expect.poll(statCalls).toBe(2);
  await expect(page.getByRole('button', { name: 'More re-generate options', exact: true })).toBeEnabled();
  if (mobile) await page.getByRole('button', { name: 'Status', exact: true }).click();
  // Read from the pre-turn calm, not the angry the first run pinned.
  await expect(page.getByText(/22\s*\/\s*100/).first()).toBeVisible();
  await expect(page.getByText(/11\s*\/\s*100/)).toHaveCount(0);
});

test('the first coded turn’s snapshot holds the code’s value, so a re-roll of the next turn starts from it', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  // The sandbox first loads on turn one; its write has to be in that turn's snapshot.
  await coinWithCode(page, 'self.value = self.previous.value + 1;');
  const statCalls = await mockModel(page, 'Coin: +20');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  const mobile = await playOneTurn(page, ['Count the coins.', 'Count them again.']);

  // 60 → 61 on turn one, 61 → 62 on turn two.
  await expect(page.getByText(/62\s*\/\s*100/).first()).toBeVisible();

  if (mobile) await page.getByRole('button', { name: 'Game', exact: true }).click();
  await page.getByRole('button', { name: 'More re-generate options', exact: true }).click();
  await page.getByRole('button', { name: 'Re-generate Stats', exact: true }).click();
  await expect.poll(statCalls).toBe(3);
  await expect(page.getByRole('button', { name: 'More re-generate options', exact: true })).toBeEnabled();
  if (mobile) await page.getByRole('button', { name: 'Status', exact: true }).click();
  // From turn one's 61, not from the 80 the AI alone would have left there.
  await expect(page.getByText(/62\s*\/\s*100/).first()).toBeVisible();
  await expect(page.getByText(/81\s*\/\s*100/)).toHaveCount(0);
});

test('a stat code bound shows as the bar’s range, and the delta reports only the value’s movement', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'self.max = 150;');
  await mockModel(page, 'Coin: +20');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  await expect(page.getByText(/80\s*\/\s*150/).first()).toBeVisible();
  await expect(page.getByText('+20', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^\+(50|70)$/)).toHaveCount(0);
});

test('stat code runs with zero asks on a turn with the stat request off', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'return self.previous.value + self.delta.ai.value + self.delta.ai.max + 5;');
  const statCalls = await mockModel(page, 'Coin: +20');
  await openApp(page, settings({ FORMAMORPH_statUpdatesEnabled: false }), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  await expect(page.getByText(/65\s*\/\s*100/).first()).toBeVisible();
  expect(statCalls()).toBe(0);
});

// The opening turn: the save is rewound to before the first narration, so this turn is the world's first.
// Code runs after that narration, over the opening turn's own zero asks.
test('stat code runs on the opening turn', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const save = JSON.parse(readFileSync('src/lib/devFixtures/whiteRoomSave.json', 'utf8'));
  await coinWithCode(page, 'return self.previous.value + 3;', {}, {
    Save: { currentState: { ...save.currentState, isGameStarted: false, fullMessageHistory: [], gameplayText: '' } },
  });
  await mockModel(page, 'Coin: +0');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  const mobile = await playOneTurn(page, ['Look around.']);

  await expect(page.getByText(/63\s*\/\s*100/).first()).toBeVisible();
  // The emptied history has to have taken, or this is an ordinary mid-game turn wearing the name. On a
  // phone the story sits on the Game tab, so read it there.
  if (mobile) await page.getByRole('button', { name: 'Game', exact: true }).click();
  await expect(page.getByText('You count the coins twice.').first()).toBeVisible();
  await expect(page.getByText(/sterile whiteness of The White Room/)).toHaveCount(0);
});

// The quiet turn. The stat request runs and the AI reports no movement. The code still runs, and its
// write lands.
test('stat code runs on a turn where the AI asks for no stat change', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'return self.previous.value + 7;');
  const statCalls = await mockModel(page, 'Coin: +0');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  await expect(page.getByText(/67\s*\/\s*100/).first()).toBeVisible();
  await expect.poll(statCalls).toBe(1);
});

// The before box runs at the start of the turn, so its pin has to be in that turn's own prompt. The
// after-the-AI twin of this case asserts the pin lands one turn later, which is what the timing changes.
test('a placeholder the before box pins reaches the same turn’s prompt', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const world = JSON.parse(readFileSync('src/lib/devFixtures/whiteRoomWorld.json', 'utf8'));
  const locations = world.locations.map((location: { id: string }) => (location.id === '1783535114538'
    ? { ...location, aiDescription: 'The walls glow {{ph:ph-mood:world:p1}}.' } : location));
  await coinWithCode(page, '', { beforeCode: 'placeholders.Mood.value = "incandescent";' }, {
    World: { placeholders: [mood], locations }, Save: calmRoll,
  });
  const narration: string[] = [];
  await mockModel(page, 'Coin: +20', narration);
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  await expect.poll(() => narration.length).toBeGreaterThanOrEqual(1);
  expect(narration[0]).toContain('The walls glow incandescent.');
  expect(narration[0]).not.toContain('The walls glow calm.');
});

// The value the before box writes is the one the tracker is asked about, not the one the turn started at.
test('a value the before box sets reaches the same turn’s stat request', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, '', { beforeCode: 'return 37;' });
  const statPrompts: string[] = [];
  await mockModel(page, 'Coin: +0', undefined, statPrompts);
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  await expect(page.getByText(/37\s*\/\s*100/).first()).toBeVisible();
  await expect.poll(() => statPrompts.length).toBeGreaterThanOrEqual(1);
  expect(statPrompts[0]).toContain('37');
  expect(statPrompts[0]).not.toContain('60');
});

// The after box reads the pins the before box left, not the ones the turn opened with.
test('the after box reads the pin the before box made', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'return { calm: 11, angry: 22 }[placeholders.Mood.value];', {
    beforeCode: 'placeholders.Mood.pin("angry");',
  }, { World: { placeholders: [mood] }, Save: calmRoll });
  await mockModel(page, 'Coin: +0');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  // Reading the turn's opening calm would leave 11.
  await expect(page.getByText(/22\s*\/\s*100/).first()).toBeVisible();
  await expect(page.getByText(/11\s*\/\s*100/)).toHaveCount(0);
});

// Turn order: the after box reads the state the before box left, plus the asks and the regen.
test('the after box reads the value the before box left, the ask on top', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'return self.value + 1;', { beforeCode: 'return 10;' });
  await mockModel(page, 'Coin: +5');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  // 10 from the before box, +5 asked, +1 from the after box. Reading the turn-start 60 would leave 66.
  await expect(page.getByText(/16\s*\/\s*100/).first()).toBeVisible();
  await expect(page.getByText(/(66|61)\s*\/\s*100/)).toHaveCount(0);
});

// A re-roll replays the whole turn from the last snapshot, so the before box runs again over it: the
// re-rolled turn lands on the same value, neither stacked on the first run nor missing the box.
test('a stats re-roll runs the before box again from the pre-turn state', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, '', { beforeCode: 'return self.value + 1;' });
  const statCalls = await mockModel(page, 'Coin: +0');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  const mobile = await playOneTurn(page);

  await expect(page.getByText(/61\s*\/\s*100/).first()).toBeVisible();

  if (mobile) await page.getByRole('button', { name: 'Game', exact: true }).click();
  await page.getByRole('button', { name: 'More re-generate options', exact: true }).click();
  await page.getByRole('button', { name: 'Re-generate Stats', exact: true }).click();
  await expect.poll(statCalls).toBe(2);
  await expect(page.getByRole('button', { name: 'More re-generate options', exact: true })).toBeEnabled();
  if (mobile) await page.getByRole('button', { name: 'Status', exact: true }).click();
  // Skipping the box on the re-roll would leave the pre-turn 60; stacking on the first run would give 62.
  await expect(page.getByText(/61\s*\/\s*100/).first()).toBeVisible();
  await expect(page.getByText(/(60|62)\s*\/\s*100/)).toHaveCount(0);
});

// The narration re-roll restores the pre-turn snapshot and re-sends the action, so the before box runs
// over that snapshot the way the first draw did.
test('a narration re-roll runs the before box again from the pre-turn state', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, '', { beforeCode: 'return self.value + 1;' });
  const statCalls = await mockModel(page, 'Coin: +0');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  const mobile = await playOneTurn(page);

  await expect(page.getByText(/61\s*\/\s*100/).first()).toBeVisible();

  if (mobile) await page.getByRole('button', { name: 'Game', exact: true }).click();
  await page.getByRole('button', { name: 'Re-generate', exact: true }).click();
  await expect.poll(statCalls).toBe(2);
  await expect(page.getByRole('button', { name: 'More re-generate options', exact: true })).toBeEnabled();
  if (mobile) await page.getByRole('button', { name: 'Status', exact: true }).click();
  // Skipping the box on the re-roll would leave the pre-turn 60; stacking on the first run would give 62.
  await expect(page.getByText(/61\s*\/\s*100/).first()).toBeVisible();
  await expect(page.getByText(/(60|62)\s*\/\s*100/)).toHaveCount(0);
});

// A turn that never commits leaves nothing behind. The before box has already written its value AND its
// pin by the time the narration comes back empty, so the failure exit has to put both back.
test('a failed turn puts back the value and the pin the before box made', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const world = JSON.parse(readFileSync('src/lib/devFixtures/whiteRoomWorld.json', 'utf8'));
  const locations = world.locations.map((location: { id: string }) => (location.id === '1783535114538'
    ? { ...location, aiDescription: 'The walls glow {{ph:ph-mood:world:p1}}.' } : location));
  // The pin the box makes depends on what it reads, so a pin left standing changes what the next turn pins.
  const flip = 'placeholders.Mood.pin(placeholders.Mood.value === "calm" ? "angry" : "serene");\n'
    + 'return self.value + 1;';
  await coinWithCode(page, '', { beforeCode: flip }, {
    World: { placeholders: [mood], locations }, Save: calmRoll,
  });
  const narration: string[] = [];
  let narrationCalls = 0;
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', async (route) => {
    const { messages } = route.request().postDataJSON();
    const system = messages.find((message: { role: string }) => message.role === 'system')?.content ?? '';
    const isStats = system.includes('stat tracker');
    if (!isStats) narration.push(JSON.stringify(messages));
    // The first narration comes back empty, which is a failed turn; the second one lands.
    const text = isStats ? 'Coin: +0' : (narrationCalls += 1) === 1 ? '' : 'You count the coins twice.';
    await route.fulfill({ contentType: 'text/event-stream', body:
      `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: [DONE]\n\n` });
  });
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page, ['Count the coins.', 'Count them again.']);

  // The failed turn's 61 goes back to 60, so the turn that lands reads 60 and leaves 61, never 62.
  await expect(page.getByText(/61\s*\/\s*100/).first()).toBeVisible();
  await expect(page.getByText(/62\s*\/\s*100/)).toHaveCount(0);
  // The pin went back with it, so the second turn's box reads the roll again and pins the same text. A pin
  // left standing would have it read angry and pin serene instead.
  await expect.poll(() => narration.length).toBeGreaterThanOrEqual(2);
  expect(narration[0]).toContain('The walls glow angry.');
  expect(narration[1]).toContain('The walls glow angry.');
  expect(narration[1]).not.toContain('serene');
});

// A path reaches the placeholder the editor shows, not the world-level one of the same name. Two rolls, one
// path: the reading follows Molly's own roll, and the world's `Hair` never answers it.
for (const [rolled, expected] of [['cropped', 11], ['long', 22]] as const) {
  test(`stat code reads placeholders.Molly.Hair on the ${rolled} roll, never the world’s own Hair`, async ({ page }) => {
    page.on('pageerror', (error) => console.error(error.message));
    const worldHair = { id: 'ph-world-hair', name: 'Hair', values: [{ id: 'v-plain', text: 'plain' }] };
    const mollyHair = {
      id: 'ph-molly-hair', name: 'Hair',
      values: [{ id: 'v-cropped', text: 'cropped' }, { id: 'v-long', text: 'long' }],
    };
    const world = JSON.parse(readFileSync('src/lib/devFixtures/whiteRoomWorld.json', 'utf8'));
    const molly = { id: 'ent-molly', name: 'Molly', placeholders: [mollyHair] };
    // 99 would mean the path fell through to the world's own Hair; no reading at all leaves 60.
    await coinWithCode(page, 'return { cropped: 11, long: 22, plain: 99 }[placeholders.Molly.Hair.value];', {}, {
      World: { placeholders: [worldHair], entities: [...world.entities, molly] },
      Save: { placeholderRolls: { world: { 'ph-molly-hair': rolled } } },
    });
    await mockModel(page, 'Coin: +20');
    await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
    await playOneTurn(page);

    await expect(page.getByText(new RegExp(`${expected}\\s*/\\s*100`)).first()).toBeVisible();
    await expect(page.getByText(/(99|60)\s*\/\s*100/)).toHaveCount(0);
  });
}
