import { useState } from "react";
import { toast } from "react-toastify";
import { AlertTriangle, Key, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessagesTab } from "@/components/menu/MessagesTab";
import { type ProfileTab } from "@/components/menu/profileTabs";
import AuthService from "@/services/AuthService";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { parseServerDate } from "@/lib/serverDate";
import { type WorldRecord } from "@/components/WorldDetails";

interface AuthModalsProps {
  showAuthDialog: boolean;
  setShowAuthDialog: (open: boolean) => void;
  showProfileDialog: boolean;
  setShowProfileDialog: (open: boolean) => void;
  currentUser: WorldRecord | null;
  userInitial: string;
  /** Called after a successful login/register so the parent can refresh its auth identity. */
  onAuthenticated: () => void;
  /** Full logout (clears the parent's auth state); the header uses the same handler. */
  onLogout: () => void;
  /** Reports the reader's unread count so the footer badge stays in step with the inbox. */
  onUnreadChange?: (unread: number) => void;
  /** Tab to open on; the dev-router uses this to land on either half directly. */
  initialTab?: ProfileTab;
}

/** The login/register dialog and the user-profile (change password / logout) dialog. Owns all auth
 *  form state; the parent controls open/close and holds the shared auth identity (via callbacks). */
export function AuthModals({
  showAuthDialog, setShowAuthDialog,
  showProfileDialog, setShowProfileDialog,
  currentUser, userInitial, onAuthenticated, onLogout,
  onUnreadChange, initialTab = 'messages',
}: AuthModalsProps) {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [profileTab, setProfileTab] = useState<ProfileTab>(initialTab);

  // A suspended account can sign in and read (that is how it reaches its suspension notice), but the
  // server refuses every write it could make from here.
  const isSuspended = currentUser?.status === 'suspended';

  // `createdAt` is a server timestamp (UTC, no zone marker); falls back to today for an account whose
  // profile hasn't been fetched yet.
  const memberSince = (
    parseServerDate(String(currentUser?.createdAt ?? '')) ?? new Date()
  ).toLocaleDateString();
  const [authError, setAuthError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const resetAuthForms = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
    setNewPassword('');
    setAuthError('');
  };

  // Reset the forms when a dialog opens, not when it closes — clearing on close blanks the still-visible
  // fields for a frame or two during the fade-out.
  useResetOnOpen(showAuthDialog, resetAuthForms);
  useResetOnOpen(showProfileDialog, () => {
    resetAuthForms();
    setProfileTab(initialTab);
  });

  const handleLogin = async () => {
    setAuthError('');

    if (!username || !password) {
      setAuthError('Username and password are required');
      return;
    }

    try {
      await AuthService.login(username, password);
      onAuthenticated();
      setShowAuthDialog(false);
      resetAuthForms();
      toast.success('Logged in successfully');
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

    try {
      await AuthService.register(username, password);
      onAuthenticated();
      setShowAuthDialog(false);
      resetAuthForms();
      toast.success('Registered successfully');
    } catch (error) {
      setAuthError((error as Error).message || 'Registration failed');
    }
  };

  const handleChangePassword = async () => {
    setAuthError('');

    if (!currentPassword || !newPassword) {
      setAuthError('Both current and new passwords are required');
      return;
    }

    try {
      await AuthService.changePassword(currentPassword, newPassword);
      setShowProfileDialog(false);
      resetAuthForms();
      toast.success('Password changed successfully');
    } catch (error) {
      setAuthError((error as Error).message || 'Failed to change password');
    }
  };

  return (
    <>
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-[425px]">
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
              <div className="text-sm text-destructive p-2 bg-destructive/10 rounded-md">
                {authError}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">Username</label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {authMode === 'register' && (
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                />
              </div>
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
              className="sm:order-2"
            >
              {authMode === 'login' ? 'Login' : 'Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-[480px] max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>

          {/* `min-w-0`: DialogContent is a grid, and a grid item's `min-width: auto` lets it grow past
              the dialog's max width — a long message subject widened the whole dialog and added a
              horizontal scrollbar instead of ellipsing. */}
          <div className="py-4 min-w-0">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-2xl font-bold">
                {userInitial}
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {currentUser?.username || 'User'}
                </h3>
                <p className="text-sm text-muted-foreground">Member since {memberSince}</p>
              </div>
            </div>

            {isSuspended && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 text-destructive mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-destructive">Account Suspended</p>
                  <p className="text-muted-foreground">Check your messages for details.</p>
                </div>
              </div>
            )}

            <Tabs value={profileTab} onValueChange={(value) => setProfileTab(value as ProfileTab)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="manage">Manage</TabsTrigger>
              </TabsList>

              <TabsContent value="messages">
                {/* Mounted only while selected, so opening the tab is what triggers the fetch. */}
                <MessagesTab active={showProfileDialog && profileTab === 'messages'} onUnreadChange={onUnreadChange} />
              </TabsContent>

              <TabsContent value="manage">
                <div className="space-y-4 py-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Key className="h-4 w-4" /> Change Password
                  </h4>

                  {/* A suspended account can sign in and read, but the server refuses every write —
                      saying so here beats letting them fill the form and be rejected on submit. */}
                  {isSuspended && (
                    <p className="text-sm text-muted-foreground">
                      Your password can&rsquo;t be changed while your account is suspended.
                    </p>
                  )}

                  {authError && (
                    <div className="text-sm text-destructive p-2 bg-destructive/10 rounded-md">
                      {authError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="currentPassword" className="text-sm font-medium">Current Password</label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      disabled={isSuspended}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="newPassword" className="text-sm font-medium">New Password</label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      disabled={isSuspended}
                    />
                  </div>

                  <Button onClick={handleChangePassword} className="w-full" disabled={isSuspended}>
                    Update Password
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="destructive" onClick={onLogout} className="w-full">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
