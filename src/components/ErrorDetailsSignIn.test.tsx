import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';

vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
// jsdom can't drive a real Lexical selection; the stub keeps the body a plain textarea whose value can be read.
vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea id="feedbackBody" aria-label={props.ariaLabel} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
  ),
}));

import { ThemedToastContainer } from './ThemedToastContainer';
import { SignInHost } from './SignInHost';
import { AgeGateProvider } from '@/contexts/AgeGateContext';
import { AccountDeletionProvider } from '@/contexts/AccountDeletionContext';
import { PrivacyPolicyProvider } from '@/contexts/PrivacyPolicyContext';
import AuthService from '@/services/AuthService';
import { AGE_GATE_VERSION, acceptAgeGate } from '@/lib/ageGate';
import { closeErrorDetails, DetailedError } from '@/lib/errorDetails';
import { closeBugReport } from '@/lib/bugReportStore';
import { toastError } from '@/lib/linkToast';

/** Stands in for the game view: a turn typed but not sent, which a remount would drop. */
function TurnInHand() {
  const [text, setText] = useState('');
  return <input aria-label="Turn" value={text} onChange={(e) => setText(e.target.value)} />;
}

let requested: string[] = [];
const answer = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  requested = [];
  localStorage.clear();
  sessionStorage.clear();
  AuthService.token = null;
  AuthService.currentUser = null;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    requested.push(url);
    if (url.endsWith('/auth/login')) return answer({ token: 'signed-token', user: { id: 'u1', username: 'alice' } });
    if (url.endsWith('/policies/age-gate')) return answer({ accepted: false, requiredVersion: AGE_GATE_VERSION, acceptedAt: null });
    if (url.endsWith('/policies/age-gate/accept')) return answer({ accepted: true, requiredVersion: AGE_GATE_VERSION, acceptedAt: null });
    if (url.endsWith('/policies')) return answer({ uploadGate: null, tagNotice: null, privacyPolicy: null });
    return answer({ data: [] });
  }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    toast.dismiss();
    closeErrorDetails();
    closeBugReport();
  });
  cleanup();
  AuthService.token = null;
  AuthService.currentUser = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The app's stack around a view: the sign-in host sits beside it, inside the age gate. */
async function openDetails() {
  render(
    <AgeGateProvider>
      <AccountDeletionProvider>
        <PrivacyPolicyProvider>
          <SignInHost />
          <TurnInHand />
          <ThemedToastContainer />
        </PrivacyPolicyProvider>
      </AccountDeletionProvider>
    </AgeGateProvider>,
  );
  act(() => toastError(new DetailedError('ComfyUI rejected the workflow', 'Node #4: missing'), 'fallback'));
  fireEvent.click(await screen.findByRole('button', { name: 'View Details →' }));
  return screen.findByRole('dialog', { name: 'Error Details' });
}

const gate = () => screen.queryByRole('dialog', { name: /Adult Content Ahead/ });
const signIn = () => screen.queryByRole('dialog', { name: 'Login' });
const titleValue = () => (document.getElementById('feedbackTitle') as HTMLInputElement).value;
const bodyValue = () => (document.getElementById('feedbackBody') as HTMLTextAreaElement).value;

const submitLogin = () => {
  fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'alice' } });
  fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'hunter22' } });
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));
};

/** Error Details is on top again, with its details as they were. */
const expectDetailsIntact = () => {
  const details = screen.getByRole('dialog', { name: 'Error Details' });
  expect(details.textContent).toContain('ComfyUI rejected the workflow');
  expect(details.textContent).toContain('Node #4: missing');
  expect(screen.queryByRole('dialog', { name: 'Send Feedback' })).toBeNull();
};

describe('Report Bug for a signed-out player', () => {
  it('runs the age check, then sign-in, then opens the filled-in report', async () => {
    await openDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Report Bug' }));

    expect(gate()).toBeInTheDocument();
    expect(signIn()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(signIn()).toBeInTheDocument();
    submitLogin();

    await screen.findByRole('dialog', { name: 'Send Feedback' });
    expect(AuthService.isAuthenticated()).toBe(true);
    expect(titleValue()).toBe('ComfyUI rejected the workflow');
    expect(bodyValue()).toBe('Node #4: missing');
    expect(screen.queryByRole('dialog', { name: 'Error Details' })).toBeNull();
    // The answer made on the way in is recorded against the account that just signed in.
    await waitFor(() => expect(requested.some((url) => url.endsWith('/policies/age-gate/accept'))).toBe(true));
  });

  it('leaves Error Details open when the age check is declined', async () => {
    await openDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Report Bug' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

    expect(gate()).toBeNull();
    expect(signIn()).toBeNull();
    expectDetailsIntact();
  });

  it('leaves Error Details open when sign-in is canceled, and a second press asks again', async () => {
    acceptAgeGate();
    await openDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Report Bug' }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Login' }), { key: 'Escape' });

    await waitFor(() => expect(signIn()).toBeNull());
    expectDetailsIntact();

    fireEvent.click(screen.getByRole('button', { name: 'Report Bug' }));
    expect(signIn()).toBeInTheDocument();
  });

  it('keeps the view underneath and its state through the sign-in', async () => {
    await openDetails();
    // Behind the open dialog, so it is read by its label: Radix hides the rest of the page from roles.
    fireEvent.change(screen.getByLabelText('Turn'), { target: { value: 'I open the door' } });

    fireEvent.click(screen.getByRole('button', { name: 'Report Bug' }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    submitLogin();
    await screen.findByRole('dialog', { name: 'Send Feedback' });
    // The account's age check runs after sign-in; the view has to outlast that too.
    await waitFor(() => expect(requested.some((url) => url.endsWith('/policies/age-gate/accept'))).toBe(true));
    await waitFor(() => expect(requested.some((url) => url.endsWith('/policies'))).toBe(true));

    expect((screen.getByLabelText('Turn') as HTMLInputElement).value).toBe('I open the door');
  });
});
