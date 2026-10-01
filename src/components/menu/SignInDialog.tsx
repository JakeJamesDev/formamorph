import { useState } from "react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PolicyDialog } from "@/components/menu/PolicyDialog";
import { usePrivacyPolicy } from "@/contexts/PrivacyPolicyContext";
import { useAgeGate } from "@/contexts/AgeGateContext";
import { useAccountDeletion } from "@/contexts/AccountDeletionContext";
import PolicyService from "@/services/PolicyService";
import AuthService from "@/services/AuthService";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import type { PublicPrivacyPolicy } from "@/types";

interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful login/register, before the dialog closes. */
  onAuthenticated: () => void;
}

/** The login/register dialog. Owns its form state; the parent controls open/close. */
export function SignInDialog({ open, onOpenChange, onAuthenticated }: SignInDialogProps) {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authError, setAuthError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Optional at signup, and never asked for at sign-in. It is what password reset runs on.
  const [email, setEmail] = useState('');

  // The Privacy Policy shown before an account is created, and null whenever there is nothing to show:
  // no policy switched on, or the reader has not reached that step. Read without a token, because at
  // this point there is no account to hold one.
  const [signupPolicy, setSignupPolicy] = useState<PublicPrivacyPolicy | null>(null);
  const [signupBusy, setSignupBusy] = useState(false);

  // The signed-in prompt. Registration answers the policy on its own, but a sign-in has to ask the
  // server whether this account already has.
  const { checkNow: checkPrivacyPolicy } = usePrivacyPolicy();
  const { authenticationSucceeded, authenticationAbandoned } = useAgeGate();

  // Signing in is what cancels a pending deletion; the notice for it lives above every screen.
  const { noticeCancelled } = useAccountDeletion();

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setEmail('');
    setAuthError('');
  };

  // Reset the form when the dialog opens, not when it closes — clearing on close blanks the still-visible
  // fields for a frame or two during the fade-out.
  useResetOnOpen(open, resetForm);

  const handleLogin = async () => {
    setAuthError('');

    if (!username || !password) {
      setAuthError('Username and password are required');
      return;
    }

    try {
      const { deletionCancelled } = await AuthService.login(username, password);
      onAuthenticated();
      authenticationSucceeded(() => { void checkPrivacyPolicy(); });
      onOpenChange(false);
      resetForm();
      toast.success('Logged in successfully');
      // Signing in is what cancels a pending deletion, and the server does it without being asked. The
      // account may not remember asking, so it is said out loud rather than left to be noticed.
      if (deletionCancelled) noticeCancelled();
    } catch (error) {
      setAuthError((error as Error).message || 'Login failed');
    }
  };

  const handleRegister = async () => {
    setAuthError('');

    // Validate username and password according to server requirements
    if (!username) {
      setAuthError('Username is required');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      setAuthError('Username must be between 3 and 20 characters');
      return;
    }

    if (!password) {
      setAuthError('Password is required');
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    // Checked here as well as in AuthService, because the policy step runs between the two. Left to the
    // service, a mistyped address would be found only after the reader had read and accepted a policy.
    if (email.trim() && !AuthService.isValidEmail(email.trim())) {
      setAuthError('Invalid email format');
      return;
    }

    // The policy is read and answered before the account exists, so declining leaves nothing behind.
    // A read that fails is not a reason to refuse a signup: the account is created, and the signed-in
    // prompt asks at the first refused request instead.
    setSignupBusy(true);
    let policy: PublicPrivacyPolicy | null = null;
    try {
      policy = await PolicyService.fetchPublicPrivacyPolicy();
    } catch (error) {
      console.error('Failed to read the privacy policy before signup:', error);
    } finally {
      setSignupBusy(false);
    }

    if (policy) {
      setSignupPolicy(policy);
      return;
    }

    // No policy to answer, so the account is made here and reported exactly as the answered path
    // reports it.
    if (await createAccount()) finishSignup();
  };

  /** Register, and report a refusal the same way whichever path arrived here. */
  const createAccount = async (): Promise<boolean> => {
    try {
      await AuthService.register(username, password, email.trim());
      authenticationSucceeded();
      return true;
    } catch (error) {
      setAuthError((error as Error).message || 'Registration failed');
      return false;
    }
  };

  /** Hand the new session to the parent and close up. Both signup paths end here, so neither can
   *  quietly skip a step the other takes. */
  const finishSignup = (resolveAgeGate = true) => {
    setSignupPolicy(null);
    onAuthenticated();
    if (resolveAgeGate) authenticationSucceeded(() => { void checkPrivacyPolicy(); });
    onOpenChange(false);
    resetForm();
    toast.success('Registered successfully');
  };

  /**
   * Accepting the policy at signup: create the account, then record the acceptance against it.
   *
   * The two cannot be one request — the acceptance needs the token registration issues — so the second
   * one is retried once. A second failure leaves a real account that has answered nothing, which is a
   * state the server already knows how to handle: it refuses, and the signed-in prompt asks again. What
   * it must never do is pass silently.
   */
  const acceptAtSignup = async () => {
    setSignupBusy(true);
    let privacyAccepted = true;
    try {
      if (!await createAccount()) {
        setSignupPolicy(null);
        return;
      }

      try {
        await PolicyService.acceptPrivacyPolicy();
      } catch {
        try {
          await PolicyService.acceptPrivacyPolicy();
        } catch (error) {
          console.error('Failed to record the privacy acceptance after signup:', error);
          toast.warn('Your account was created, but recording your acceptance failed. You will be asked again.');
          privacyAccepted = false;
          void checkPrivacyPolicy();
        }
      }

      finishSignup(privacyAccepted);
    } finally {
      setSignupBusy(false);
    }
  };

  /** Declining at signup. Nothing has been sent, and nothing is: the account is never created. */
  const declineAtSignup = () => {
    setSignupPolicy(null);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) authenticationAbandoned();
          onOpenChange(next);
        }}
      >
        <DialogContent surface="auth" className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{authMode === 'login' ? 'Login' : 'Register'}</DialogTitle>
            <DialogDescription>
              {authMode === 'login'
                ? 'Enter your credentials to access your account.'
                : 'Create a new account to save and share your worlds.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {authError && (
              <div className="text-label text-destructive p-2 bg-destructive/10 rounded-md">
                {authError}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="username" className="text-label font-medium">Username</label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-label font-medium">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {authMode === 'login' && (
              <p className="text-right text-helper">
                <a
                  href="https://formamorph.ai/reset-password"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Forgot password?
                </a>
              </p>
            )}

            {authMode === 'register' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-label font-medium">Confirm Password</label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                  />
                </div>

                {/* Last, and only in register mode, so switching between the two modes never moves a
                    box the reader is already typing in. */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-label font-medium">Email (Optional)</label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                  <p className="text-meta text-muted-foreground">
                    Lets you reset your password. We send one message to confirm it.
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="sm:order-1"
            >
              {authMode === 'login' ? 'Create Account' : 'Back to Login'}
            </Button>

            <Button
              onClick={authMode === 'login' ? handleLogin : handleRegister}
              disabled={signupBusy}
              className="sm:order-2"
            >
              {authMode === 'login' ? 'Login' : 'Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shown before the account exists. Declining closes it and creates nothing — the reader is still
          signed out, with the form behind this untouched. */}
      {signupPolicy && (
        <PolicyDialog
          open
          title={signupPolicy.title}
          body={signupPolicy.body}
          confirmLabel="Accept and Create Account"
          cancelLabel="Decline"
          onConfirm={() => { void acceptAtSignup(); }}
          onCancel={declineAtSignup}
          busy={signupBusy}
        />
      )}
    </>
  );
}
