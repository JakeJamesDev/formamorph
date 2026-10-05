import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LANDING_PULSE_CLASS, LANDING_RING_CLASS } from '@/lib/landingPulse';
import { LandingPulseReference } from './LandingPulseReference';

const renderReference = () => render(<TooltipProvider><LandingPulseReference /></TooltipProvider>);
const panel = (name: 'Light' | 'Dark') => screen.getByRole('region', { name: `${name} Theme` });
const sampleRow = (name: 'Light' | 'Dark', key: string) =>
  panel(name).querySelector<HTMLElement>(`[data-landing-sample="${key}"]`)!;

afterEach(() => vi.unstubAllGlobals());

describe('landing pulse reference', () => {
  it('pulses the target row in the pressed theme, focuses its control, and ends on the animation end', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
    const user = userEvent.setup();
    renderReference();
    await user.click(within(panel('Dark')).getByRole('button', { name: 'Play Landing' }));

    const row = sampleRow('Dark', 'paragraphLimit');
    expect(row).toHaveClass(LANDING_PULSE_CLASS);
    expect(sampleRow('Light', 'paragraphLimit')).not.toHaveClass(LANDING_PULSE_CLASS);
    // jsdom draws no layout, so both widths' controls count; the label's info button never does.
    expect([within(row).getByRole('combobox'), within(row).getByRole('radio', { checked: true })]).toContain(document.activeElement);

    act(() => { row.dispatchEvent(Object.assign(new Event('animationend', { bubbles: true }), { animationName: 'landing-pulse' })); });
    expect(row).not.toHaveClass(LANDING_PULSE_CLASS);
  });

  it('draws the still ring on the chosen row while Reduced Motion is checked', async () => {
    const user = userEvent.setup();
    renderReference();
    await user.click(screen.getByRole('checkbox', { name: 'Reduced Motion' }));
    await user.click(screen.getByRole('radio', { name: 'Model Name' }));
    await user.click(within(panel('Light')).getByRole('button', { name: 'Play Landing' }));

    const row = sampleRow('Light', 'modelName');
    expect(row).toHaveClass(LANDING_RING_CLASS);
    expect(row).not.toHaveClass(LANDING_PULSE_CLASS);
    expect(document.activeElement).toBe(within(row).getByRole('textbox'));
  });
});
