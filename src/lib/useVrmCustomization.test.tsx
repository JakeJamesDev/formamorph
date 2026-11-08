import { describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useVrmCustomization, type VrmCustomization } from './useVrmCustomization';
import type { VRMCapabilities } from '@/views/VRMViewer';

const CAPS: VRMCapabilities = {
  bodyMorphs: ['Waist'],
  headMorphs: ['Ear Shape'],
  hairStyles: [],
  hairLength: false,
  colors: {},
  extras: [],
};

/** The hook's controls rendered by the component that owns the hook, with the model's capabilities reported. */
function setup(caps: VRMCapabilities) {
  const latest: { current: VrmCustomization | null } = { current: null };
  function Harness() {
    const customization = useVrmCustomization(false);
    latest.current = customization;
    return <>{customization.controls}</>;
  }
  render(<Harness />);
  act(() => latest.current!.setCaps(caps));
  return { hook: { result: latest as { current: VrmCustomization } } };
}

const section = (heading: string) => screen.getByRole('heading', { name: heading }).parentElement as HTMLElement;

describe('useVrmCustomization head sliders', () => {
  it('shows a Head Features slider per head key, running from 0 to 1', () => {
    setup(CAPS);

    const thumb = within(section('Head Features')).getByRole('slider');
    expect(within(section('Head Features')).getByText('Ear Shape')).toBeInTheDocument();
    expect(thumb).toHaveAttribute('aria-valuemin', '0');
    expect(thumb).toHaveAttribute('aria-valuemax', '1');
  });

  it('keeps body sliders in their own section with the wider range', () => {
    setup(CAPS);

    const thumb = within(section('Initial Body Features')).getByRole('slider');
    expect(within(section('Initial Body Features')).getByText('Waist')).toBeInTheDocument();
    expect(within(section('Initial Body Features')).queryByText('Ear Shape')).not.toBeInTheDocument();
    expect(thumb).toHaveAttribute('aria-valuemin', '-0.25');
    expect(thumb).toHaveAttribute('aria-valuemax', '1.25');
  });

  it('sends a head slider value to the viewer and the saved character, keyed by name', async () => {
    const { hook } = setup(CAPS);

    within(section('Head Features')).getByRole('slider').focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');

    expect(hook.result.current.viewerProps.bodyMorphValues['Ear Shape']).toBeCloseTo(0.1);
    expect(hook.result.current.characterData.bodyMorphs['Ear Shape']).toBeCloseTo(0.1);
  });

  it('shows no Head Features section for a model without head keys', () => {
    setup({ ...CAPS, headMorphs: [] });

    expect(screen.queryByRole('heading', { name: 'Head Features' })).not.toBeInTheDocument();
  });
});
