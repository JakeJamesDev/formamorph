import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { useBackStop } from '@/hooks/useBackStop';

// Stand-in for the Capacitor App plugin: the listeners the app registered, and the exits it asked for.
// A plain recorder, because a `vi.hoisted` body cannot reference `vi`.
const bridge = vi.hoisted(() => ({
  listeners: [] as (() => void)[],
  exits: 0,
  reset() {
    bridge.listeners = [];
    bridge.exits = 0;
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, listener: () => void) => {
      if (event !== 'backButton') throw new Error(`Listened for an unexpected event: ${event}`);
      bridge.listeners.push(listener);
      return Promise.resolve({
        remove: () => {
          bridge.listeners = bridge.listeners.filter((registered) => registered !== listener);
          return Promise.resolve();
        },
      });
    },
    exitApp: () => {
      bridge.exits += 1;
      return Promise.resolve();
    },
  },
}));

import { AndroidBackHandler } from './AndroidBackHandler';

/** A screen that fills its view without being a modal — the avatar editor, the first-run intro. */
function SubScreen({ onBack }: { onBack?: () => void }) {
  useBackStop(onBack);
  return <div>Avatar</div>;
}

/** What the phone's back button does: every listener the app registered fires. */
const pressBack = () => act(() => bridge.listeners.forEach((listener) => listener()));

beforeEach(() => bridge.reset());
afterEach(() => vi.restoreAllMocks());

describe('AndroidBackHandler', () => {
  it('closes the open modal instead of leaving the view', async () => {
    const onGoBack = vi.fn();
    render(
      <>
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>World Editor</DialogTitle>
            <DialogDescription>Any modal at all, standing over the view.</DialogDescription>
          </DialogContent>
        </Dialog>
        <AndroidBackHandler viewHistory={['mainMenu', 'gameViewer']} onGoBack={onGoBack} />
      </>,
    );
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));
    expect(screen.getByText('World Editor')).toBeInTheDocument();

    pressBack();

    expect(screen.queryByText('World Editor')).not.toBeInTheDocument();
    expect(onGoBack).not.toHaveBeenCalled();
    expect(bridge.exits).toBe(0);
    expect(screen.queryByText('Close Formamorph')).not.toBeInTheDocument();
  });

  it('asks before leaving a view whose exit costs the player, and leaves on Confirm', async () => {
    const onGoBack = vi.fn();
    render(
      <AndroidBackHandler
        viewHistory={['mainMenu', 'gameViewer']}
        onGoBack={onGoBack}
        confirmGoBack={{ title: 'Exit to Main Menu', description: 'Any unsaved progress will be lost.' }}
      />,
    );
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));

    pressBack();

    expect(onGoBack).not.toHaveBeenCalled();
    expect(screen.getByText('Exit to Main Menu')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onGoBack).toHaveBeenCalledTimes(1);
    expect(bridge.exits).toBe(0);
  });

  it('stays in the view when that prompt is cancelled', async () => {
    const onGoBack = vi.fn();
    render(
      <AndroidBackHandler
        viewHistory={['mainMenu', 'gameViewer']}
        onGoBack={onGoBack}
        confirmGoBack={{ title: 'Exit to Main Menu', description: 'Any unsaved progress will be lost.' }}
      />,
    );
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));
    pressBack();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onGoBack).not.toHaveBeenCalled();
  });

  it('offers to close the app, not to leave the view, once the prompt is answered', async () => {
    render(
      <AndroidBackHandler
        viewHistory={['mainMenu']}
        onGoBack={vi.fn()}
        confirmGoBack={{ title: 'Exit to Main Menu', description: 'Any unsaved progress will be lost.' }}
      />,
    );
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));

    pressBack();

    expect(screen.getByText('Close Formamorph')).toBeInTheDocument();
    expect(screen.queryByText('Exit to Main Menu')).not.toBeInTheDocument();
  });

  it('leaves the view when nothing is layered over it', async () => {
    const onGoBack = vi.fn();
    render(<AndroidBackHandler viewHistory={['mainMenu', 'gameViewer']} onGoBack={onGoBack} />);
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));

    pressBack();

    expect(onGoBack).toHaveBeenCalledTimes(1);
    expect(bridge.exits).toBe(0);
    expect(screen.queryByText('Close Formamorph')).not.toBeInTheDocument();
  });

  it('asks before closing the app from the first view, and closes it on Confirm', async () => {
    const onGoBack = vi.fn();
    render(<AndroidBackHandler viewHistory={['mainMenu']} onGoBack={onGoBack} />);
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));

    pressBack();

    expect(onGoBack).not.toHaveBeenCalled();
    expect(screen.getByText('Close Formamorph')).toBeInTheDocument();
    expect(bridge.exits).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(bridge.exits).toBe(1);
  });

  it('dismisses its own prompt on a second press rather than closing the app', async () => {
    render(<AndroidBackHandler viewHistory={['mainMenu']} onGoBack={vi.fn()} />);
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));
    pressBack();
    expect(screen.getByText('Close Formamorph')).toBeInTheDocument();

    pressBack();

    expect(screen.queryByText('Close Formamorph')).not.toBeInTheDocument();
    expect(bridge.exits).toBe(0);
  });

  it('stops listening once it is unmounted', async () => {
    const { unmount } = render(<AndroidBackHandler viewHistory={['mainMenu']} onGoBack={vi.fn()} />);
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));

    unmount();

    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(0));
  });
  it('leaves a full-screen sub-screen instead of offering to close the app', async () => {
    const onGoBack = vi.fn();
    const leaveSubScreen = vi.fn();
    render(
      <>
        <SubScreen onBack={leaveSubScreen} />
        <AndroidBackHandler
          viewHistory={['mainMenu', 'gameViewer']}
          onGoBack={onGoBack}
          confirmGoBack={{ title: 'Exit to Main Menu', description: 'Any unsaved progress will be lost.' }}
        />
      </>,
    );
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));

    pressBack();

    expect(leaveSubScreen).toHaveBeenCalledTimes(1);
    expect(onGoBack).not.toHaveBeenCalled();
    expect(screen.queryByText('Exit to Main Menu')).not.toBeInTheDocument();
    expect(screen.queryByText('Close Formamorph')).not.toBeInTheDocument();
    expect(bridge.exits).toBe(0);
  });

  it('closes a modal opened over a sub-screen before it leaves the sub-screen', async () => {
    const leaveSubScreen = vi.fn();
    render(
      <>
        <SubScreen onBack={leaveSubScreen} />
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Pick a Model</DialogTitle>
            <DialogDescription>A dialog raised from inside the sub-screen.</DialogDescription>
          </DialogContent>
        </Dialog>
        <AndroidBackHandler viewHistory={['mainMenu']} onGoBack={vi.fn()} />
      </>,
    );
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));

    pressBack();

    expect(screen.queryByText('Pick a Model')).not.toBeInTheDocument();
    expect(leaveSubScreen).not.toHaveBeenCalled();
    expect(screen.getByText('Avatar')).toBeInTheDocument();
  });

  it('offers to close the app again once the sub-screen is gone', async () => {
    const { rerender } = render(
      <>
        <SubScreen onBack={vi.fn()} />
        <AndroidBackHandler viewHistory={['mainMenu']} onGoBack={vi.fn()} />
      </>,
    );
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));

    rerender(<AndroidBackHandler viewHistory={['mainMenu']} onGoBack={vi.fn()} />);
    pressBack();

    expect(screen.getByText('Close Formamorph')).toBeInTheDocument();
  });

  it('lets the press fall through when a sub-screen claims no way back', async () => {
    const onGoBack = vi.fn();
    render(
      <>
        <SubScreen />
        <AndroidBackHandler viewHistory={['mainMenu', 'gameViewer']} onGoBack={onGoBack} />
      </>,
    );
    await vi.waitFor(() => expect(bridge.listeners).toHaveLength(1));

    pressBack();

    expect(onGoBack).toHaveBeenCalledTimes(1);
  });
});
