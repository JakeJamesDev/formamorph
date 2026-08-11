import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { TUTORIAL_APPEAR_DELAY_MS, resetTutorials, seenTutorials, useTutorial } from './tutorials';

/**
 * The main menu's two footer explanations, which are never both available: the profile circle offers an
 * account while signed out, and the feedback circle only exists once there is one. What this guards is
 * the handover — signing in must reach the feedback note without restarting the app.
 */

const Menu = ({ signedIn }: { signedIn: boolean }) => {
  const { active, nav, dismiss } = useTutorial('mainMenu', {
    held: signedIn ? ['main-menu-sign-in'] : ['main-menu-feedback'],
  });
  return (
    <div>
      <span>{active ? active.title : 'nothing'}</span>
      <button onClick={nav.next}>Got It</button>
      <button onClick={() => dismiss('main-menu-feedback')}>use feedback</button>
    </div>
  );
};

const settle = () => act(() => { vi.advanceTimersByTime(TUTORIAL_APPEAR_DELAY_MS + 50); });

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe('main menu explanations', () => {
  it('offers an account while signed out, and holds the feedback note', () => {
    render(<Menu signedIn={false} />);
    settle();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(seenTutorials()).not.toContain('main-menu-feedback');
  });

  it('explains feedback to a reader who already has an account', () => {
    render(<Menu signedIn />);
    settle();
    expect(screen.getByText('Bugs & Suggestions')).toBeInTheDocument();
  });

  it('reaches the feedback note when the reader signs in, without a restart', () => {
    // The button it explains does not exist until sign-in, so a tour planned while signed out cannot
    // contain it — and the reader would never see it if the plan were final.
    const view = render(<Menu signedIn={false} />);
    settle();
    expect(screen.getByText('Sign In')).toBeInTheDocument();

    view.rerender(<Menu signedIn />);
    settle();
    expect(screen.getByText('Bugs & Suggestions')).toBeInTheDocument();
  });

  it('does not spend a held explanation when its control is used anyway', () => {
    // Signed out there is no feedback button, but nothing may mark its note read on the reader's behalf.
    render(<Menu signedIn={false} />);
    settle();
    act(() => { screen.getByRole('button', { name: 'use feedback' }).click(); });
    expect(seenTutorials()).not.toContain('main-menu-feedback');
  });

  it('stops offering an account once the sign-in note has been read', () => {
    const view = render(<Menu signedIn={false} />);
    settle();
    act(() => { screen.getByRole('button', { name: 'Got It' }).click(); });
    expect(screen.getByText('nothing')).toBeInTheDocument();

    view.unmount();
    render(<Menu signedIn={false} />);
    settle();
    expect(screen.getByText('nothing')).toBeInTheDocument();
  });
});
