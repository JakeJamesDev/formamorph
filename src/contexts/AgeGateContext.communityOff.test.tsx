import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgeGateProvider, useAgeGate } from './AgeGateContext';
import AuthService from '@/services/AuthService';

/**
 * The build that ships with the community features compiled off.
 *
 * The flag has to be mocked, which hoists per file, so this case cannot sit with the rest of the gate's
 * tests. It drives the provider through a stand-in for the surfaces that ask — the menu button and the
 * sign-in circle are unrendered in this build, so there is no real one left to click.
 */

vi.mock('@/lib/featureFlags', () => ({ COMMUNITY_ENABLED: false }));

function Surface() {
  const { attested, requireAttestation } = useAgeGate();
  return (
    <>
      <span>{attested ? 'unlocked' : 'gated'}</span>
      <button onClick={() => requireAttestation({ onAccept: () => { /* opened */ } })}>Open</button>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  AuthService.token = null;
});

describe('a build with the community features off', () => {
  it('raises no gate, even for a session that would have been asked at boot', () => {
    AuthService.token = 'stored-token';

    render(<AgeGateProvider><Surface /></AgeGateProvider>);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('unlocked')).toBeInTheDocument();
  });

  it('lets a surface straight through rather than asking a question it has no dialog for', () => {
    render(<AgeGateProvider><Surface /></AgeGateProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
