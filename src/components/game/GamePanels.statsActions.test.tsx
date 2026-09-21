import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRightPanel, statFixture } from '@/test/gamePanels';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const turns = [
  { action: 'rest', narration: 'You rest.', turnId: 't1' },
  { action: 'walk', narration: 'You walk.', turnId: 't2' },
];
const options = { turns, stats: [statFixture('Vigor', 50)] };
const regenerate = () => screen.getByRole('button', { name: 'Re-generate Stats' });

describe('Stats panel actions', () => {
  it('places regeneration after edit and calls it for the viewed latest turn', () => {
    const view = renderRightPanel({}, options);
    const edit = screen.getByRole('button', { name: 'Edit Stats' });
    expect(edit.nextElementSibling).toBe(regenerate());
    fireEvent.click(regenerate());
    expect(view.props.onRegenerateStats).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('shows the Edit Stats tooltip and keeps its edit toggle', async () => {
    renderRightPanel({}, options);
    const edit = screen.getByRole('button', { name: 'Edit Stats' });
    await userEvent.hover(edit);
    expect(await screen.findByText('Edit Stats')).toBeVisible();
    fireEvent.click(edit);
    expect(edit).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('spinbutton', { name: 'Vigor' })).toBeInTheDocument();
  });

  it.each(['tags', 'image'] as const)('blocks regeneration during a scene %s job and enables it when the job ends', (sceneImageJob) => {
    const view = renderRightPanel({ sceneImageJob }, options);
    expect(regenerate()).toBeDisabled();
    fireEvent.click(regenerate());
    expect(view.props.onRegenerateStats).not.toHaveBeenCalled();
    view.setProps({ sceneImageJob: null });
    expect(regenerate()).toBeEnabled();
    fireEvent.click(regenerate());
    expect(view.props.onRegenerateStats).toHaveBeenCalledExactlyOnceWith(2);
  });

  it.each(['setIsWaitingForAI', 'setIsRevealingNarration'] as const)('blocks regeneration during %s and enables it afterward', (setter) => {
    const view = renderRightPanel({}, { ...options, seed: (gameplay) => gameplay[setter](true) });
    expect(regenerate()).toBeDisabled();
    fireEvent.click(regenerate());
    expect(view.props.onRegenerateStats).not.toHaveBeenCalled();
    act(() => view.gameplay()[setter](false));
    expect(regenerate()).toBeEnabled();
    fireEvent.click(regenerate());
    expect(view.props.onRegenerateStats).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('blocks regeneration on a past turn and enables it on returning to the latest turn', () => {
    const view = renderRightPanel({}, { ...options, page: 1 });
    expect(regenerate()).toBeDisabled();
    fireEvent.click(regenerate());
    expect(view.props.onRegenerateStats).not.toHaveBeenCalled();
    act(() => {
      view.gameplay().setUserPage(2);
      view.gameplay().setDisplayedMessages(view.gameplay().fullMessageHistory.slice(-2));
    });
    expect(regenerate()).toBeEnabled();
    fireEvent.click(regenerate());
    expect(view.props.onRegenerateStats).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('hides regeneration when stat updates are off but keeps editing', () => {
    renderRightPanel({}, { ...options, settings: (settings) => settings.setStatUpdatesEnabled(false) });
    expect(screen.queryByRole('button', { name: 'Re-generate Stats' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Stats' })).toBeEnabled();
  });

  it('offers no stats controls in a world without stats', () => {
    renderRightPanel({}, { turns });
    expect(screen.queryByRole('button', { name: 'Re-generate Stats' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Stats' })).toBeNull();
  });
});
