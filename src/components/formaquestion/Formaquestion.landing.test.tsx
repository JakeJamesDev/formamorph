import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { LANDING_PULSE_CLASS, LANDING_RING_CLASS } from '@/lib/landingPulse';
import { SURFACE_TARGETS } from '@/lib/surface/surfaceTargets';
import { sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { storeFramedWindow, stubHelpStream } from '@/test/helpFixtures';
import { stubReducedMotion } from '@/test/reducedMotion';
import { renderReporting } from '@/test/surfaceReporter';
import { frames, recordScrolls, rowOf } from '@/test/landing';
import { FormaquestionSettings } from './FormaquestionSettings';
import type { FormaquestionSettingsTab } from './formaquestionSettingsTabs';
import { DEFAULT_HELP_SETTINGS } from '@/lib/formaquestion/helpSettings';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { HelpAi } from './useHelpAi';

/** Take Me There landing in the help window: its own view tabs and settings tabs land a target row. */

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
import { Formaquestion } from './Formaquestion';

const GUIDE = (route: string) => ({
  Help: `# ❓ Help\n\nThe help window answers questions.\n\n## How to Change the Chat Style\n\n<!-- route: ${route} -->\n\n1. Open the settings.\n`,
});
const loader = (route: string) => () => Promise.resolve(createDocsIndex({ pages: GUIDE(route), sidebar: '- [Help](Help)\n' }));

const conversation = () => screen.getByRole('log', { name: 'Conversation' });

/** Asks one question, then presses Take Me There on the answer whose top source carries `route`. */
async function takeMeThere(route: string) {
  stubHelpStream(sseReply('Open the settings.'));
  render(<Formaquestion loadIndex={loader(route)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  await userEvent.type(await screen.findByRole('textbox', { name: 'Ask a Question' }), 'How do I change the chat style?');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await within(conversation()).findByRole('group', { name: 'Sources' });
  await userEvent.click(within(conversation()).getByRole('button', { name: 'Take Me There' }));
}

const scrolled = recordScrolls();
beforeEach(() => {
  localStorage.clear();
  storeFramedWindow({ sourcesOpen: true });
  ai.current = helpAi({ requestSurface: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Take Me There in the help window', () => {
  it('lands a settings target: scrolled, focused and pulsed once', async () => {
    const route = 'formaquestionSettings.general#chat-style';
    await takeMeThere(route);
    await waitFor(() => expect(rowOf(route)?.classList.contains(LANDING_PULSE_CLASS)).toBe(true));
    const row = rowOf(route)!;
    expect(scrolled).toContain(row);
    expect(row.contains(document.activeElement)).toBe(true);
    expect(document.querySelectorAll(`.${LANDING_PULSE_CLASS}`)).toHaveLength(1);
    expect(ai.current.requestSurface).not.toHaveBeenCalled();
  });

  it('draws the still ring under reduced motion', async () => {
    stubReducedMotion();
    const route = 'formaquestionSettings.general#backdrop';
    await takeMeThere(route);
    await waitFor(() => expect(rowOf(route)?.classList.contains(LANDING_RING_CLASS)).toBe(true));
    expect(rowOf(route)!.classList.contains(LANDING_PULSE_CLASS)).toBe(false);
  });

  it('lands a target on another settings tab', async () => {
    const route = 'formaquestionSettings.prompts#preset';
    await takeMeThere(route);
    const dialog = await screen.findByRole('dialog', { name: 'Formaquestion Settings' });
    expect(within(dialog).getByRole('tab', { name: 'Prompts' })).toHaveAttribute('data-state', 'active');
    await waitFor(() => expect(scrolled).toContain(rowOf(route)));
    expect(rowOf(route)!.contains(document.activeElement)).toBe(true);
  });

  it('lands a target on a view tab of the window', async () => {
    const route = 'formaquestion.search#search-field';
    await takeMeThere(route);
    await waitFor(() => expect(scrolled).toContain(rowOf(route)));
    expect(rowOf(route)!.contains(document.activeElement)).toBe(true);
    expect(rowOf(route)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true);
  });

  it('lands again on a repeat request for the same target', async () => {
    const route = 'formaquestionSettings.general#chat-style';
    await takeMeThere(route);
    await waitFor(() => expect(scrolled).toHaveLength(1));
    const row = rowOf(route)!;
    row.dispatchEvent(Object.assign(new Event('animationend', { bubbles: true }), { animationName: LANDING_PULSE_CLASS }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Formaquestion Settings' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Formaquestion Settings' })).toBeNull());
    await userEvent.click(await within(conversation()).findByRole('button', { name: 'Take Me There' }));
    await waitFor(() => expect(scrolled).toHaveLength(2));
    expect(rowOf(route)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true);
  });

  it.each(['full', 'minimal'] as const)('lands on the question field of the %s chat style', async (chatStyle) => {
    storeFramedWindow({ sourcesOpen: true, chatStyle });
    const route = 'formaquestion.ask#question-field';
    await takeMeThere(route);
    await waitFor(() => expect(scrolled).toContain(rowOf(route)));
    expect(rowOf(route)!.contains(document.activeElement)).toBe(true);
  });

  it('lands on the tab with no error and no pulse when the target is not on screen', async () => {
    const errors = vi.spyOn(console, 'error');
    // The scroll arrow shows only while the reader is away from the end of the conversation.
    await takeMeThere('formaquestion.ask#scroll-to-end');
    await frames(32);
    expect(rowOf('formaquestion.ask#scroll-to-end')).toBeNull();
    expect(document.querySelector(`.${LANDING_PULSE_CLASS}`)).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });
});

describe('Formaquestion Settings rows', () => {
  const settingsTargets = Object.entries(SURFACE_TARGETS)
    .filter(([surface]) => surface.startsWith('formaquestionSettings.'))
    .flatMap(([surface, targets]) => targets.map((target) => [surface.slice('formaquestionSettings.'.length) as FormaquestionSettingsTab, target] as const));

  const renderSettings = (tab: FormaquestionSettingsTab) => renderReporting(
    <SettingsProvider>
      <FormaquestionSettings
        open
        onOpenChange={() => {}}
        tab={tab}
        onTabChange={() => {}}
        // Minimal shows every General row; Bubble hides Mascot Position (Q9), which the bubble suite covers.
        settings={{ ...DEFAULT_HELP_SETTINGS, chatStyle: 'minimal' }}
        onChange={() => {}}
        semantic={{ on: false, downloading: false, progress: null, error: null, setOn: () => {} }}
        answerTarget={{ reasoning: UNKNOWN_REASONING_CAPABILITY, localEngine: false, maxTokens: undefined }}
      />
    </SettingsProvider>,
  );

  it.each(settingsTargets)('the %s tab has a row for %s', (tab, target) => {
    renderSettings(tab);
    expect(rowOf(`formaquestionSettings.${tab}#${target}`)).not.toBeNull();
  });

  it('carries no Settings row on the Tools tab, so a Settings landing never finds it', () => {
    renderSettings('tools');
    expect(document.querySelector('[data-surface-target^="settings."]')).toBeNull();
  });
});
