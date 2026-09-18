// The Demo AI notice inside the real settings provider: what the player sees on entry, and what each control
// does. The build is the hosted one, so the built-in Default preset is the Demo AI.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRef } from 'react';
import { act, render, screen, within } from '@testing-library/react';
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
import { DemoAIBadge, DemoAINotice, type DemoAINoticeHandle } from './DemoAINotice';
import { DEMO_AI_SEEN_KEY } from './demoAISeen';

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

/** Mounts the notice and its badge the way the game view does. `entry` is the entry order releasing the dialog. */
function mountNotice(entry = true) {
  const onEntryDone = vi.fn();
  const ref = createRef<DemoAINoticeHandle>();
  const tree = (e: boolean) => (
    <TooltipProvider>
      <SettingsProvider>
        <Probe />
        <DemoAIBadge onOpen={() => ref.current?.open()} />
        <DemoAINotice ref={ref} entry={e} onEntryDone={onEntryDone} />
      </SettingsProvider>
    </TooltipProvider>
  );
  const view = render(tree(entry));
  return { ...view, onEntryDone, ref, enter: () => view.rerender(tree(true)) };
}

const TITLE = "You're Playing on the Demo AI";
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

describe('DemoAINotice on entry', () => {
  it('shows the spec copy word for word when narration resolves to the Demo AI', () => {
    mountNotice();
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
    for (const text of [
      "Formamorph is using its free built-in AI. It's a small model, and it's here so you can try the app with zero setup.",
      'The AI writes everything you read. A stronger model gives you sharper narration, a better memory of your story, and characters who stay in character. Nothing else in Formamorph changes the experience as much.',
      'If a world feels flat, try it on a stronger model before you judge it.',
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

  it('writes the seen-key when it shows, and a later entry opens nothing', () => {
    const first = mountNotice();
    expect(dialog()).not.toBeNull();
    expect(localStorage.getItem(DEMO_AI_SEEN_KEY)).not.toBeNull();
    first.unmount();

    const second = mountNotice();
    expect(dialog()).toBeNull();
    expect(second.onEntryDone).toHaveBeenCalledTimes(1);
  });

  it('stays seen after a switch to another endpoint and back', async () => {
    const first = mountNotice();
    await userEvent.click(screen.getByRole('button', { name: 'Keep Playing' }));
    const userId = addUserPreset();
    act(() => settings.selectTextEndpointPreset(userId));
    first.unmount();

    const away = mountNotice();
    expect(dialog()).toBeNull();
    act(() => settings.selectTextEndpointPreset(DEFAULT_TEXT_PRESET_ID));
    away.unmount();

    mountNotice();
    expect(settings.narrationIsDemoAI).toBe(true);
    expect(dialog()).toBeNull();
  });

  it('opens nothing when narration routes to another endpoint, even with other prompts on the Demo AI', () => {
    const view = mountNotice(false);
    const userId = addUserPreset();
    route({ narration: userId, choices: DEFAULT_TEXT_PRESET_ID });
    expect(settings.activeTextEndpointIsDemoAI).toBe(true);
    view.enter();
    expect(dialog()).toBeNull();
    expect(view.onEntryDone).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DEMO_AI_SEEN_KEY)).toBeNull();
  });

  it('opens when narration routes to the Demo AI while another endpoint is active', () => {
    const view = mountNotice(false);
    const userId = addUserPreset();
    act(() => settings.selectTextEndpointPreset(userId));
    route({ narration: DEFAULT_TEXT_PRESET_ID });
    view.enter();
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
  });

  it('waits for the entry order to release it', () => {
    const view = mountNotice(false);
    expect(dialog()).toBeNull();
    expect(localStorage.getItem(DEMO_AI_SEEN_KEY)).toBeNull();
    view.enter();
    expect(dialog()).not.toBeNull();
  });
});

describe('DemoAINotice controls', () => {
  it('Connect an AI closes the dialog and asks for Settings on the Endpoints tab', async () => {
    const view = mountNotice();
    await userEvent.click(screen.getByRole('button', { name: 'Connect an AI' }));
    expect(dialog()).toBeNull();
    expect(settings.settingsRequest).toMatchObject({ tab: 'endpoints' });
    expect(view.onEntryDone).toHaveBeenCalledTimes(1);
  });

  it('Keep Playing closes the dialog and ends the entry turn', async () => {
    const view = mountNotice();
    await userEvent.click(screen.getByRole('button', { name: 'Keep Playing' }));
    expect(dialog()).toBeNull();
    expect(settings.settingsRequest).toBeNull();
    expect(view.onEntryDone).toHaveBeenCalledTimes(1);
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

  it('opens from outside the entry path without ending an entry turn', async () => {
    const view = mountNotice(false);
    act(() => view.ref.current?.open());
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep Playing' }));
    expect(dialog()).toBeNull();
    expect(view.onEntryDone).not.toHaveBeenCalled();
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
    const view = mountNotice(false);
    await userEvent.click(badge()!);
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep Playing' }));
    expect(dialog()).toBeNull();
    expect(badge()).not.toBeNull();
    expect(view.onEntryDone).not.toHaveBeenCalled();
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
