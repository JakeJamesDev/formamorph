// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { useState } from 'react';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import { DEFAULT_MASCOT_RIG } from '@/lib/formaquestion/mascot';
import { LANDING_PULSE_CLASS } from '@/lib/landingPulse';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { findTargetRow, routeText } from '@/lib/surface/surfaceTargets';
import { mascotStoreOf } from '@/test/helpFixtures';
import { renderReporting } from '@/test/surfaceReporter';
import { FormaquestionSettings } from './FormaquestionSettings';
import type { FormaquestionSettingsTab } from './formaquestionSettingsTabs';
import type { SemanticSearch } from './useSemanticSearch';

const SEMANTIC: SemanticSearch = { on: false, downloading: false, progress: null, error: null, setOn: () => {} };
const OFF_LINE = 'The Mascot is off. Enable it in “General” to customize it.';

let current: HelpSettings;
/** Changes settings from outside the dialog, the way another window or the dev router would. */
let change: (patch: Partial<HelpSettings>) => void;

/** The dialog over live settings and a live tab, as Formaquestion holds them. */
function Host({ initial }: { initial: HelpSettings }) {
  const [settings, setSettings] = useState(initial);
  const [tab, setTab] = useState<FormaquestionSettingsTab>('general');
  current = settings;
  change = (patch) => setSettings((was) => helpSettingsOf(patch, was));
  return (
    <FormaquestionSettings
      open
      onOpenChange={() => {}}
      tab={tab}
      onTabChange={setTab}
      settings={settings}
      onChange={(patch) => setSettings((was) => helpSettingsOf(patch, was))}
      semantic={SEMANTIC}
      answerTarget={{ reasoning: UNKNOWN_REASONING_CAPABILITY, localEngine: false, maxTokens: undefined }}
    />
  );
}

const mount = (fields: Partial<HelpSettings> = {}) =>
  renderReporting(<Host initial={{ ...DEFAULT_HELP_SETTINGS, mascotPresets: mascotStoreOf(DEFAULT_MASCOT_RIG), ...fields }} />);
const dialog = () => screen.getByRole('dialog', { name: 'Formaquestion Settings', hidden: true });
/** Hidden too: an open prompt hides the dialog behind it from the accessibility tree. */
const tab = (name: string) => within(dialog()).getByRole('tab', { name, hidden: true });
const offStatus = () => within(dialog()).getByTestId('mascot-off-status');
const openMascotTab = () => userEvent.click(tab('Mascot'));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('the Mascot switch on General', () => {
  it('opens the Window section with Mascot, then Chat Style, Mascot Position and Backdrop', () => {
    // Bubble hides Mascot Position; Minimal shows every row.
    mount({ chatStyle: 'minimal' });
    const section = within(dialog()).getByRole('heading', { name: 'Window' }).closest('section')!;
    const controls = [...section.querySelectorAll<HTMLElement>('[role="checkbox"], [role="combobox"], [role="slider"]')];
    const ordered = [
      within(section).getByRole('checkbox', { name: 'Mascot' }),
      within(section).getByRole('combobox', { name: 'Chat Style' }),
      within(section).getByRole('combobox', { name: 'Mascot Position' }),
      within(section).getByRole('slider', { name: 'Backdrop' }),
    ];
    expect(ordered.map((el) => controls.indexOf(el))).toEqual([0, 1, 2, 3]);
  });

  it('turns the Mascot on and off at once, with no Save', async () => {
    mount();
    const box = within(dialog()).getByRole('checkbox', { name: 'Mascot' });
    expect(current.mascot).toBe(true);
    await userEvent.click(box);
    expect(current.mascot).toBe(false);
    await userEvent.click(box);
    expect(current.mascot).toBe(true);
  });
});

describe('the Mascot tab off state', () => {
  it('shows no switch and no line while the Mascot is on', async () => {
    mount();
    await openMascotTab();
    expect(within(dialog()).queryByRole('checkbox', { name: 'Mascot' })).toBeNull();
    expect(offStatus()).toBeEmptyDOMElement();
  });

  it('shows the line after the switch goes off on General, and its link opens General', async () => {
    mount();
    await userEvent.click(within(dialog()).getByRole('checkbox', { name: 'Mascot' }));
    await openMascotTab();
    expect(offStatus()).toHaveTextContent(OFF_LINE);
    expect(within(dialog()).getByRole('combobox', { name: 'Preset' })).toBeDisabled();

    await userEvent.click(within(offStatus()).getByRole('button', { name: 'General' }));
    expect(tab('General')).toHaveAttribute('data-state', 'active');
    // The link lands on the Mascot row: the Landing Pulse ring and focus on the switch, as Take Me There does.
    const row = findTargetRow(dialog(), routeText('formaquestionSettings.general', 'mascot-switch'))!;
    await waitFor(() => expect(row).toHaveClass(LANDING_PULSE_CLASS));
    expect(within(row).getByRole('checkbox', { name: 'Mascot' })).toHaveFocus();
    // The switch is the way back: on again, and the tab's controls work.
    await userEvent.click(within(dialog()).getByRole('checkbox', { name: 'Mascot' }));
    await openMascotTab();
    expect(offStatus()).toBeEmptyDOMElement();
    expect(within(dialog()).getByRole('combobox', { name: 'Preset' })).toBeEnabled();
  });

  it('runs the unsaved prompt before the link changes tabs when the draft is dirty', async () => {
    mount();
    await openMascotTab();
    await userEvent.click(within(dialog()).getByRole('checkbox', { name: 'Enable Rest' }));
    expect(within(dialog()).getByRole('button', { name: 'Save' })).toBeEnabled();
    act(() => change({ mascot: false }));
    await waitFor(() => expect(offStatus()).toHaveTextContent(OFF_LINE));

    const link = () => within(offStatus()).getByRole('button', { name: 'General' });
    await userEvent.click(link());
    const prompt = await screen.findByRole('alertdialog');
    expect(tab('Mascot')).toHaveAttribute('data-state', 'active');

    await userEvent.click(within(prompt).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(tab('Mascot')).toHaveAttribute('data-state', 'active');

    await userEvent.click(link());
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Exit Without Saving' }));
    await waitFor(() => expect(tab('General')).toHaveAttribute('data-state', 'active'));
  });

  it('opens General at once when the draft is clean', async () => {
    mount({ mascot: false });
    await openMascotTab();
    await userEvent.click(within(offStatus()).getByRole('button', { name: 'General' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(tab('General')).toHaveAttribute('data-state', 'active');
  });
});
