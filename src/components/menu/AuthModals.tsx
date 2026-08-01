import { useCallback, useEffect, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessagesTab } from "@/components/menu/MessagesTab";
import { ProfileAvatarEditor } from "@/components/menu/ProfileAvatarEditor";
import { type ProfileTab } from "@/components/menu/profileTabs";
import { MyFeedbackTab } from "@/components/menu/MyFeedbackTab";
import { TermsTab } from "@/components/menu/TermsTab";
import PolicyService from "@/services/PolicyService";
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
  /** Called after a successful login/register so the parent can refresh its auth identity. */
  onAuthenticated: () => void;
  /** Full logout (clears the parent's auth state); the header uses the same handler. */
  onLogout: () => void;
  /** Reports the reader's unread count so the footer badge stays in step with the inbox. */
  onUnreadChange?: (unread: number) => void;
  /** Fired when a feedback thread is read or replied to, so the host can re-read its badge count. */
  onBugsChange?: () => void;
  /** Tab to open on; the dev-router uses this to land on either half directly. */
  initialTab?: ProfileTab;
  /** Fired when the reader changes their own profile image, so the host's header follows it. */
  onAvatarChanged?: (avatarUrl: string | null) => void;
}

/** The login/register dialog and the user-profile (change password / logout) dialog. Owns all auth
 *  form state; the parent controls open/close and holds the shared auth identity (via callbacks). */
export function AuthModals({
  showAuthDialog, setShowAuthDialog,
  showProfileDialog, setShowProfileDialog,
  currentUser, onAuthenticated, onLogout,
  onUnreadChange, onBugsChange, onAvatarChanged, initialTab = 'messages',
}: AuthModalsProps) {
  // Held locally as well as on the host: the header has to change the moment the crop is saved, and the
  // host's copy arrives a render later.
  const [avatarUrl, setAvatarUrl] = useState<string | null>((currentUser?.avatarUrl as string | null) ?? null);

  // Follow the host when it hands over a different account — a login while this was mounted would
  // otherwise leave the previous reader's face in the header.
  useEffect(() => {
    setAvatarUrl((currentUser?.avatarUrl as string | null) ?? null);
  }, [currentUser]);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [profileTab, setProfileTab] = useState<ProfileTab>(initialTab);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  // Whether an admin has authored a gate at all. Until one exists there is nothing to show or agree to,
  // so the tab is absent rather than empty. `null` while the answer is still unknown — falling back on
  // "not yet fetched" would knock a requested Terms tab to Messages before the check ever ran.
  const [hasTerms, setHasTerms] = useState<boolean | null>(null);

  // A suspended account can sign in and read (that is how it reaches its suspension notice), but the
  // server refuses every write it could make from here.
  const isSuspended = currentUser?.status === 'suspended';

  // Asked once per opening. Failing quietly leaves the tab hidden, which is the state every install had
  // before an admin wrote a gate — never a reason to break the rest of the dialog.
  const checkTerms = useCallback(async () => {
    try {
      const state = await PolicyService.fetchPolicies();
      setHasTerms(Boolean(state.uploadGate));
    } catch (error) {
      console.error('Failed to check for contributor terms:', error);
      setHasTerms(false);
    }
  }, []);

  useEffect(() => {
    if (showProfileDialog) checkTerms();
  }, [showProfileDialog, checkTerms]);

  // Nothing renders for a tab that isn't there, so a request for Terms on an install without a gate
  // falls back rather than showing an empty panel.
  useEffect(() => {
    if (hasTerms === false && profileTab === 'terms') setProfileTab('messages');
  }, [hasTerms, profileTab]);

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

  // Also honor a *change* of `initialTab` while the dialog is already open — the dev-router points at a
  // tab by changing this prop, and without it a second `goto` at an open dialog is silently ignored.
  useEffect(() => { setProfileTab(initialTab); }, [initialTab]);

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
      setShowPasswordDialog(false);
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
        <DialogContent className="sm:max-w-[900px] h-[90dvh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>

          {/* Identity and the account actions. Frozen with the header: the actions belong to the account,
              not to whichever tab is open, and the banner is state rather than content. */}
          <div className="flex-shrink-0 min-w-0">
            <div className="flex items-center gap-4 mb-4">
              <ProfileAvatarEditor
                username={currentUser?.username as string | undefined}
                avatarUrl={avatarUrl}
                onChanged={(url) => { setAvatarUrl(url); onAvatarChanged?.(url); }}
                disabled={isSuspended}
              />
              <div className="min-w-0">
                <h3 className="text-lg font-semibold truncate">
                  {currentUser?.username || 'User'}
                </h3>
                <p className="text-sm text-muted-foreground">Member since {memberSince}</p>
              </div>

              <div className="ml-auto flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPasswordDialog(true)}>
                  <Key className="mr-2 h-4 w-4" /> Change Password
                </Button>
                <Button variant="destructive" size="sm" onClick={onLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
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
          </div>

          {/* `min-w-0`: DialogContent is a grid, and a grid item's `min-width: auto` lets it grow past
              the dialog's max width — a long message subject widened the whole dialog and added a
              horizontal scrollbar instead of ellipsing. */}
          <Tabs
            value={profileTab}
            onValueChange={(value) => setProfileTab(value as ProfileTab)}
            className="w-full min-w-0 flex flex-col flex-1 min-h-0"
          >
            {/* The terms tab is absent until an admin has authored a gate, so most installs see two. */}
            <TabsList className={`grid w-full flex-shrink-0 ${hasTerms ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="bugs">Bugs</TabsTrigger>
              <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
              {hasTerms && <TabsTrigger value="terms">Terms</TabsTrigger>}
            </TabsList>

            {/* Only the panel scrolls; the identity, actions and tab strip stay put. */}
            <TabsContent value="messages" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1 min-h-0 px-1">
                {/* Mounted only while selected, so opening the tab is what triggers the fetch. */}
                <MessagesTab active={showProfileDialog && profileTab === 'messages'} onUnreadChange={onUnreadChange} />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="bugs" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1 min-h-0 px-1">
                {/* Reading a thread clears its share of the badge, so the count outside is re-read. */}
                <MyFeedbackTab active={showProfileDialog && profileTab === 'bugs'} type="bug" onChanged={onBugsChange} />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="suggestions" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1 min-h-0 px-1">
                <MyFeedbackTab active={showProfileDialog && profileTab === 'suggestions'} type="suggestion" onChanged={onBugsChange} />
              </ScrollArea>
            </TabsContent>

            {hasTerms && (
              <TabsContent value="terms" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
                <ScrollArea className="flex-1 min-h-0 px-1">
                  <TermsTab active={showProfileDialog && profileTab === 'terms'} />
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Change Password: the flow that used to be the Manage tab, now behind the header button. */}
      <Dialog
        open={showPasswordDialog}
        onOpenChange={(open) => { setShowPasswordDialog(open); if (!open) resetAuthForms(); }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="h-4 w-4" /> Change Password</DialogTitle>
            <DialogDescription>Enter your current password, then the one you want instead.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={isSuspended}>Update Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
