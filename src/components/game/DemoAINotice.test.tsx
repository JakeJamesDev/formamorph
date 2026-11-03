// The Demo AI notice inside the real settings provider: what the player sees on entry, and what each control
// does. The build is the hosted one, so the built-in Default preset is the Demo AI.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRef } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const rig = vi.hoisted(() => {
  vi.stubEnv('VITE_DEFAULT_ENDPOINT', '');
  return { nativeApp: false };
});

vi.mock('@capacitor/core', async (orig) => {
  const actual = await orig<typeof import('@capacitor/core')>();
  return { ...actual, Capacitor: { ...actual.Capacitor, isNativePlatform: () => rig.nativeApp } };
});

import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DEFAULT_TEXT_PRESET_ID } from '@/lib/textEndpointPresets';
import { DemoAIBadge, DemoAIEntryLine, DemoAINotice, type DemoAINoticeHandle } from './DemoAINotice';
import { registerDocsOpener } from '@/lib/formaquestion/docsOpener';
import { DEMO_AI_SEEN_KEY, useDemoAIEntryLine } from './demoAISeen';

const UA = {
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  iPhoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  // iPadOS Safari asks for the desktop site by default, so it sends a Mac user agent.
  iPadSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
};

const setDevice = (userAgent: string, maxTouchPoints = 0) => {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
};
const setDesktopApp = (on: boolean) => {
  const w = window as unknown as { formamorphDesktop?: unknown };
  if (on) w.formamorphDesktop = {};
  else delete w.formamorphDesktop;
};

type Settings = ReturnType<typeof useSettings>;
let settings: Settings;
function Probe() {
  settings = useSettings();
  return null;
}

function EntryLine({ aiGateDue }: { aiGateDue: boolean | null }) {
  return useDemoAIEntryLine(aiGateDue) ? <DemoAIEntryLine /> : null;
}

/** Mounts the notice, its badge and the entry line the way the game view does. `aiGateDue` is the entry's gate fact. */
function mountEntry(aiGateDue: boolean | null = false) {
  const ref = createRef<DemoAINoticeHandle>();
  const tree = (due: boolean | null) => (
    <TooltipProvider>
      <SettingsProvider>
        <Probe />
        <EntryLine aiGateDue={due} />
        <DemoAIBadge onOpen={() => ref.current?.open()} />
        <DemoAINotice ref={ref} />
      </SettingsProvider>
    </TooltipProvider>
  );
  const view = render(tree(aiGateDue));
  return { ...view, ref, setGateDue: (due: boolean | null) => view.rerender(tree(due)) };
}

/** Mounts the entry, with the dialog open by default as the badge opens it. */
function mountNotice(open = true) {
  const view = mountEntry();
  if (open) act(() => view.ref.current?.open());
  return view;
}

const TITLE = "You're Playing on the Demo AI";
const ENTRY_LINE = "You're on the Demo AI, a small free model. Select its badge to learn more.";
const entryLine = () => screen.queryByText(ENTRY_LINE);
const dialog = () => screen.queryByRole('dialog');
/** A paragraph whose whole text, across its bold and link runs, reads exactly `text`. */
const paragraph = (text: string) =>
  within(screen.getByRole('dialog')).queryByText((_, el) => el?.tagName === 'P' && el.textContent === text);

const DESKTOP_PITCH = "Want to run a model on your own PC? The desktop app has the AI engine built in, so there's nothing extra to install. The model you can run depends on your hardware.";

/** Adds a user endpoint preset and returns its id. Adding one selects it, so the Demo AI is selected again. */
const addUserPreset = () => {
  let id = '';
  act(() => { id = settings.addTextEndpointPreset('My Server'); });
  act(() => settings.selectTextEndpointPreset(DEFAULT_TEXT_PRESET_ID));
  return id;
};

/** Pins prompt kinds to endpoint presets. Routing lives on a user prompt preset, so one is made active first. */
const route = (pins: Partial<Record<'narration' | 'choices', string>>) => {
  act(() => { settings.selectPreset(settings.addPreset('Routed')); });
  act(() => {
    for (const [kind, id] of Object.entries(pins)) settings.setPromptEndpoint(kind as 'narration' | 'choices', id);
  });
  expect(settings.promptEndpoints).toEqual(pins);
};

beforeEach(() => {
  localStorage.clear();
  rig.nativeApp = false;
  setDesktopApp(false);
  setDevice(UA.windowsChrome);
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline (test)'))));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the Demo AI entry line', () => {
  it('shows with no dialog and no control of its own, and writes the seen-key', () => {
    mountEntry();
    expect(entryLine()).not.toBeNull();
    expect(dialog()).toBeNull();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Demo AI']);
    expect(localStorage.getItem(DEMO_AI_SEEN_KEY)).not.toBeNull();
  });

  it('stays on after the seen-key is written, and a later entry shows nothing', () => {
    const first = mountEntry();
    expect(entryLine()).not.toBeNull();
    first.setGateDue(false);
    expect(entryLine()).not.toBeNull();
    first.unmount();

    mountEntry();
    expect(entryLine()).toBeNull();
  });

  it('stays hidden after a switch to another endpoint and back', () => {
    const first = mountEntry();
    const userId = addUserPreset();
    act(() => settings.selectTextEndpointPreset(userId));
    expect(entryLine()).toBeNull();
    first.unmount();

    const away = mountEntry();
    expect(entryLine()).toBeNull();
    act(() => settings.selectTextEndpointPreset(DEFAULT_TEXT_PRESET_ID));
    away.unmount();

    mountEntry();
    expect(settings.narrationIsDemoAI).toBe(true);
    expect(entryLine()).toBeNull();
  });

  it('leaves the seen-key unset when narration routes to another endpoint, even with other prompts on the Demo AI', () => {
    const view = mountEntry(null);
    const userId = addUserPreset();
    route({ narration: userId, choices: DEFAULT_TEXT_PRESET_ID });
    expect(settings.activeTextEndpointIsDemoAI).toBe(true);
    view.setGateDue(false);
    expect(entryLine()).toBeNull();
    expect(localStorage.getItem(DEMO_AI_SEEN_KEY)).toBeNull();
  });

  it('shows when narration routes to the Demo AI while another endpoint is active', () => {
    const view = mountEntry(null);
    const userId = addUserPreset();
    act(() => settings.selectTextEndpointPreset(userId));
    route({ narration: DEFAULT_TEXT_PRESET_ID });
    view.setGateDue(false);
    expect(entryLine()).not.toBeNull();
  });

  it('waits for reachability, with the seen-key unset until then', () => {
    const view = mountEntry(null);
    expect(entryLine()).toBeNull();
    expect(localStorage.getItem(DEMO_AI_SEEN_KEY)).toBeNull();
    view.setGateDue(false);
    expect(entryLine()).not.toBeNull();
  });

  it('gives the entry to a due gate and shows on the next entry instead', () => {
    const first = mountEntry(true);
    first.setGateDue(false);
    expect(entryLine()).toBeNull();
    expect(localStorage.getItem(DEMO_AI_SEEN_KEY)).toBeNull();
    first.unmount();

    mountEntry();
    expect(entryLine()).not.toBeNull();
  });

  it('shows nothing on a later switch to the Demo AI in the same entry', () => {
    const view = mountEntry(null);
    const userId = addUserPreset();
    act(() => settings.selectTextEndpointPreset(userId));
    view.setGateDue(false);
    expect(entryLine()).toBeNull();
    act(() => settings.selectTextEndpointPreset(DEFAULT_TEXT_PRESET_ID));
    expect(entryLine()).toBeNull();
    expect(localStorage.getItem(DEMO_AI_SEEN_KEY)).toBeNull();
  });
});

describe('DemoAINotice content', () => {
  it('shows the spec copy word for word', () => {
    mountNotice();
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
    for (const text of [
      "You're playing on Formamorph's free built-in AI. It's a small model, and it's here so you can try the app with no setup.",
      'The AI writes everything you read. A stronger model writes sharper narration, remembers more of your story, and keeps each entity consistent. Nothing else in Formamorph changes your game as much.',
      'If a world seems dull, try it on a stronger model before you judge it.',
      'For the full experience, connect your own AI in Settings. Any OpenAI-compatible endpoint works, local or hosted. How to set up your own AI',
      DESKTOP_PITCH,
    ]) {
      expect(paragraph(text), text).not.toBeNull();
    }
    const buttons = within(screen.getByRole('dialog'));
    expect(buttons.getByRole('button', { name: 'Connect an AI' })).toBeInTheDocument();
    expect(buttons.getByRole('link', { name: 'Get the Desktop App' })).toBeInTheDocument();
    expect(buttons.getByRole('button', { name: 'Keep Playing' })).toBeInTheDocument();
  });

  it('writes the seen-key when the badge opens it before any line has shown', async () => {
    const view = mountEntry(null);
    expect(localStorage.getItem(DEMO_AI_SEEN_KEY)).toBeNull();
    act(() => view.ref.current?.open());
    expect(localStorage.getItem(DEMO_AI_SEEN_KEY)).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Keep Playing' }));
    view.setGateDue(false);
    expect(entryLine()).toBeNull();
  });
});

describe('DemoAINotice controls', () => {
  it('Connect an AI closes the dialog and asks for Settings on the Endpoints tab', async () => {
    mountNotice();
    await userEvent.click(screen.getByRole('button', { name: 'Connect an AI' }));
    expect(dialog()).toBeNull();
    expect(settings.settingsRequest).toMatchObject({ tab: 'endpoints' });
  });

  it('Keep Playing closes the dialog', async () => {
    mountNotice();
    await userEvent.click(screen.getByRole('button', { name: 'Keep Playing' }));
    expect(dialog()).toBeNull();
    expect(settings.settingsRequest).toBeNull();
  });

  it('Get the Desktop App opens formamorph.ai in a new tab', () => {
    mountNotice();
    const link = within(screen.getByRole('dialog')).getByRole('link', { name: 'Get the Desktop App' });
    expect(link).toHaveAttribute('href', 'https://formamorph.ai');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('the setup link opens the Connect Your Own AI wiki page in a new tab', () => {
    mountNotice();
    const link = within(screen.getByRole('dialog')).getByRole('link', { name: 'How to set up your own AI' });
    expect(link).toHaveAttribute('href', 'https://github.com/JakeJamesDev/formamorph/wiki/Connect-Your-Own-AI');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('the setup link opens the reader and closes the dialog when a reader is mounted', async () => {
    const open = vi.fn();
    const unregister = registerDocsOpener(open);
    try {
      mountNotice();
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'How to set up your own AI' }));
      expect(open).toHaveBeenCalledWith({ page: 'Connect-Your-Own-AI' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    } finally {
      unregister();
    }
  });

  it('orders the actions negative first, so the shared footer puts Connect an AI on the right', () => {
    mountNotice();
    const actions = within(screen.getByRole('dialog')).getAllByRole('button')
      .concat(within(screen.getByRole('dialog')).getAllByRole('link', { name: 'Get the Desktop App' }))
      .filter((el) => el.textContent !== 'Close')
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map((el) => el.textContent);
    expect(actions).toEqual(['Keep Playing', 'Get the Desktop App', 'Connect an AI']);
  });

  it('puts the initial focus on Connect an AI', async () => {
    mountNotice();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect an AI' })).toHaveFocus());
  });

  it('keeps the actions outside the scrolling body', () => {
    mountNotice();
    const body = screen.getByTestId('demo-ai-body');
    expect(body).toContainElement(screen.getByRole('link', { name: 'How to set up your own AI' }));
    expect(body).not.toContainElement(screen.getByRole('button', { name: 'Connect an AI' }));
    expect(body).not.toContainElement(screen.getByRole('button', { name: 'Keep Playing' }));
  });
});

describe('DemoAINotice desktop pitch', () => {
  const pitchShown = () => {
    const shown = paragraph(DESKTOP_PITCH) !== null;
    const button = within(screen.getByRole('dialog')).queryByRole('link', { name: 'Get the Desktop App' }) !== null;
    expect(button).toBe(shown);
    return shown;
  };

  it('shows in a desktop browser', () => {
    mountNotice();
    expect(pitchShown()).toBe(true);
  });

  it.each([
    ['Android', UA.androidChrome, 5],
    ['iPhone', UA.iPhoneSafari, 5],
    ['iPad', UA.iPadSafari, 5],
  ])('hides on an %s user agent', (_, userAgent, touch) => {
    setDevice(userAgent, touch);
    mountNotice();
    expect(pitchShown()).toBe(false);
  });

  it('hides in the native app', () => {
    rig.nativeApp = true;
    mountNotice();
    expect(pitchShown()).toBe(false);
  });

  it('hides in the desktop app', () => {
    setDesktopApp(true);
    const view = mountNotice(false);
    act(() => view.ref.current?.open());
    expect(pitchShown()).toBe(false);
  });
});

describe('DemoAINotice badge', () => {
  const badge = () => screen.queryByRole('button', { name: 'Demo AI' });
  const TIP = 'A small free model for trying Formamorph. For much better narration, connect a stronger AI in Settings.';
  const TIP_DESKTOP = `${TIP} The desktop app can run one on your PC if your hardware allows.`;
  /** The tooltip bubble's whole text, read after keyboard focus opens it. */
  const tipText = async () => {
    await userEvent.tab();
    expect(badge()).toHaveFocus();
    // The bubble is the element that holds the bold Settings run itself.
    return screen.getByText((_, el) => !!el && Array.from(el.children).some((c) => c.tagName === 'STRONG' && c.textContent === 'Settings')).textContent;
  };

  it('shows while narration resolves to the Demo AI, with the seen-key already set', () => {
    localStorage.setItem(DEMO_AI_SEEN_KEY, '1');
    mountNotice(false);
    expect(badge()).not.toBeNull();
  });

  it('goes away on a switch to another endpoint and comes back on a return, with no remount', () => {
    mountNotice(false);
    const userId = addUserPreset();
    expect(badge()).not.toBeNull();
    act(() => settings.selectTextEndpointPreset(userId));
    expect(badge()).toBeNull();
    act(() => settings.selectTextEndpointPreset(DEFAULT_TEXT_PRESET_ID));
    expect(badge()).not.toBeNull();
  });

  it('follows the narration route, not the active endpoint', () => {
    mountNotice(false);
    const userId = addUserPreset();
    route({ narration: userId, choices: DEFAULT_TEXT_PRESET_ID });
    expect(badge()).toBeNull();
    act(() => settings.selectTextEndpointPreset(userId));
    act(() => settings.setPromptEndpoint('narration', DEFAULT_TEXT_PRESET_ID));
    expect(badge()).not.toBeNull();
  });

  it('has no dismiss control: it is the only control while the dialog is closed', () => {
    mountNotice(false);
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Demo AI']);
  });

  it('opens the dialog on click, and it stays after the dialog closes', async () => {
    localStorage.setItem(DEMO_AI_SEEN_KEY, '1');
    mountNotice(false);
    await userEvent.click(badge()!);
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep Playing' }));
    expect(dialog()).toBeNull();
    expect(badge()).not.toBeNull();
  });

  it('opens the dialog from the keyboard', async () => {
    mountNotice(false);
    await userEvent.tab();
    expect(badge()).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
  });

  it('holds the spec tooltip copy, with the desktop sentence in a desktop browser', async () => {
    mountNotice(false);
    expect(await tipText()).toBe(TIP_DESKTOP);
  });

  it.each([
    ['an Android user agent', () => setDevice(UA.androidChrome, 5)],
    ['an iPhone user agent', () => setDevice(UA.iPhoneSafari, 5)],
    ['an iPad user agent', () => setDevice(UA.iPadSafari, 5)],
    ['the native app', () => { rig.nativeApp = true; }],
    ['the desktop app', () => setDesktopApp(true)],
  ])('drops the desktop sentence in %s', async (_, arrange) => {
    arrange();
    mountNotice(false);
    // The desktop app starts on its built-in engine, so the player selects the Demo AI.
    act(() => settings.selectTextEndpointPreset(DEFAULT_TEXT_PRESET_ID));
    expect(await tipText()).toBe(TIP);
  });
});
