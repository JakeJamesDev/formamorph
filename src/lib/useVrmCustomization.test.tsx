import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

describe('useVrmCustomization color rows', () => {
  const enterHex = async (name: string, hex: string) => {
    fireEvent.click(screen.getByRole('button', { name }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Hex Color' }), { target: { value: hex } });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Hex Color' })).toBeNull());
  };

  it('offers the themed picker per channel, not the native color input', () => {
    setup({ ...CAPS, colors: { hair: '#112233' } });

    const trigger = screen.getByRole('button', { name: 'Hair Color' });
    expect(trigger).toHaveAccessibleDescription('#112233');
    expect(trigger.querySelector('[data-color-swatch]')).not.toBeNull();
    expect(document.querySelector('input[type="color"]')).toBeNull();
  });

  it('sends a picked hex to the viewer as #rrggbb, and the revert button drops it again', async () => {
    const { hook } = setup({ ...CAPS, colors: { hair: '#112233' } });

    await enterHex('Hair Color', 'AA11CC');
    expect(hook.result.current.viewerProps.hairColor).toBe('#aa11cc');

    fireEvent.click(screen.getByRole('button', { name: 'Undo Hair Color' }));
    expect(hook.result.current.viewerProps.hairColor).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Hair Color' })).toHaveAccessibleDescription('#112233');
  });
});

describe('useVrmCustomization undo', () => {
  const undo = (name: string) => screen.getByRole('button', { name: `Undo ${name}` });

  it('keeps an untouched color undo disabled, enables it after a pick, and disables it after the click', async () => {
    setup({ ...CAPS, colors: { hair: '#112233' } });
    expect(undo('Hair Color')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Hair Color' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Hex Color' }), { target: { value: 'AA11CC' } });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(undo('Hair Color')).toBeEnabled());

    fireEvent.click(undo('Hair Color'));
    expect(undo('Hair Color')).toBeDisabled();
  });

  it('keeps a color undo disabled on a model that reports no color, until a pick', () => {
    setup(CAPS);
    expect(undo('Skin Color')).toBeDisabled();
  });

  it.each([['Head Features', 'Ear Shape'], ['Initial Body Features', 'Waist']])('puts a %s slider back alone', async (heading, name) => {
    const { hook } = setup(CAPS);
    expect(undo(name)).toBeDisabled();

    within(section(heading)).getByRole('slider').focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(undo(name)).toBeEnabled();
    expect(hook.result.current.viewerProps.bodyMorphValues[name]).toBeCloseTo(0.1);

    fireEvent.click(undo(name));
    expect(hook.result.current.viewerProps.bodyMorphValues[name]).toBe(0);
    expect(undo(name)).toBeDisabled();
  });

  it('puts Hair Length back to the model\'s own length', async () => {
    const { hook } = setup({ ...CAPS, hairStyles: ['ponytail'], hairLength: true });
    expect(undo('Hair Length')).toBeDisabled();

    within(section('Hair')).getByRole('slider').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(undo('Hair Length')).toBeEnabled();

    fireEvent.click(undo('Hair Length'));
    expect(hook.result.current.viewerProps.hairLength).toBe(0);
    expect(undo('Hair Length')).toBeDisabled();
  });

  it('has no undo on the hair style', () => {
    setup({ ...CAPS, hairStyles: ['ponytail', 'bobcut'], hairLength: true });
    expect(screen.queryByRole('button', { name: /Undo Hair Style/ })).toBeNull();
  });
});

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
