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
import { NotificationsTab } from "@/components/menu/NotificationsTab";
import { TermsTab } from "@/components/menu/TermsTab";
import { AccountSettingsTab } from "@/components/menu/AccountSettingsTab";
import PolicyService from "@/services/PolicyService";
import AuthService from "@/services/AuthService";
import UserService from "@/services/UserService";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { parseServerDate } from "@/lib/serverDate";
import { type WorldRecord } from "@/components/WorldDetails";
import type { PublicProfile } from "@/types";
import { ProfileStats } from "@/components/community/ProfileStats";

interface AuthModalsProps {
  showProfileDialog: boolean;
  setShowProfileDialog: (open: boolean) => void;
  currentUser: WorldRecord | null;
  /** Full logout (clears the parent's auth state); the header uses the same handler. */
  onLogout: () => void;
  /** Reports the reader's unread count so the footer badge stays in step with the inbox. */
  onUnreadChange?: (unread: number) => void;
  /** Tab to open on; the dev-router uses this to land on either half directly. */
  initialTab?: ProfileTab;
  /** Changes with each outside request, so a repeat request selects its tab again. */
  requestKey?: string;
  /** Fired when the reader changes their own profile image, so the host's header follows it. */
  onAvatarChanged?: (avatarUrl: string | null) => void;
  /** Fired once the notification feed has been read, so the badge outside drops its share. */
  onNotificationsRead?: () => void;
  /** Opens a listing from the feed; the host closes this dialog and takes them to it. */
  onOpenListing?: (listing: { id: string; kind: string }) => void;
}

/** The user-profile dialog and its change-password popup. Owns the password form state; the parent
 *  controls open/close and holds the shared auth identity. Sign-in is `SignInDialog`, raised through the
 *  sign-in store. */
export function AuthModals({
  showProfileDialog, setShowProfileDialog,
  currentUser, onLogout,
  onUnreadChange, onAvatarChanged, onNotificationsRead, onOpenListing,
  initialTab, requestKey,
}: AuthModalsProps) {
  // Held locally as well as on the host: the header has to change the moment the crop is saved, and the
  // host's copy arrives a render later.
  const [avatarUrl, setAvatarUrl] = useState<string | null>((currentUser?.avatarUrl as string | null) ?? null);
  // Your own numbers. Read from the same public profile route everybody else's comes from, so what you
  // see here is what a stranger clicking your name sees, rather than a second answer to one question.
  const [profileStats, setProfileStats] = useState<PublicProfile | null>(null);

  // Follow the host when it hands over a different account — a login while this was mounted would
  // otherwise leave the previous reader's face in the header.
  useEffect(() => {
    setAvatarUrl((currentUser?.avatarUrl as string | null) ?? null);
  }, [currentUser]);
  const [profileTab, setProfileTab] = useState<ProfileTab>(initialTab ?? 'messages');
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

  useEffect(() => {
    const id = currentUser?.id as string | undefined;
    if (!showProfileDialog || !id) return;

    let cancelled = false;
    UserService.fetchProfile(id)
      .then((p) => { if (!cancelled) setProfileStats(p); })
      // Silent: these numbers are not worth a toast, and the row simply stays absent.
      .catch(() => { if (!cancelled) setProfileStats(null); });

    return () => { cancelled = true; };
  }, [showProfileDialog, currentUser]);

  // `createdAt` is a server timestamp (UTC, no zone marker). It rides the profile fetch, not the login
  // reply, so it's absent until that resolves — and the login-cached user never carries it at all.
  // Absent renders nothing: a date that silently defaults reads as a real join date.
  const memberSince = parseServerDate(
    String(profileStats?.createdAt ?? currentUser?.createdAt ?? ''),
  )?.toLocaleDateString();
  const [passwordError, setPasswordError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setPasswordError('');
  };

  // Reset the forms when the dialog opens, not when it closes — clearing on close blanks the still-visible
  // fields for a frame or two during the fade-out.
  useResetOnOpen(showProfileDialog, () => {
    resetPasswordForm();
    setProfileTab(initialTab ?? 'messages');
  });

  // Also honor a *change* of `initialTab` while the dialog is already open — the dev-router points at a
  // tab by changing this prop, and without it a second `goto` at an open dialog is silently ignored.
  useEffect(() => { if (initialTab) setProfileTab(initialTab); }, [initialTab, requestKey]);

  const handleChangePassword = async () => {
    setPasswordError('');

    if (!currentPassword || !newPassword) {
      setPasswordError('Both current and new passwords are required');
      return;
    }

    try {
      await AuthService.changePassword(currentPassword, newPassword);
      setShowPasswordDialog(false);
      resetPasswordForm();
      toast.success('Password changed successfully');
    } catch (error) {
      setPasswordError((error as Error).message || 'Failed to change password');
    }
  };

  return (
    <>
      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent surface="profile" aria-describedby={undefined} className="sm:max-w-[900px] h-[90dvh] flex flex-col overflow-hidden">
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
                notify={(message, kind) => toast[kind](message)}
                disabled={isSuspended}
              />
              <div className="min-w-0 space-y-1">
                <h3 className="text-title font-semibold truncate">
                  {currentUser?.username || 'User'}
                </h3>
                {memberSince && <p className="text-helper text-muted-foreground">Member since {memberSince}</p>}
                {/* The same row a stranger reads on your profile popup. */}
                {profileStats && <ProfileStats profile={profileStats} />}
              </div>

              <div className="ml-auto flex flex-wrap justify-end gap-2">
                <Button variant="destructive" size="sm" onClick={onLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Log Out
                </Button>
              </div>
            </div>

            {isSuspended && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 text-destructive mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-label">
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
            surfaceTabs="profile"
            value={profileTab}
            onValueChange={(value) => setProfileTab(value as ProfileTab)}
            className="w-full min-w-0 flex flex-col flex-1 min-h-0"
          >
            {/* The terms tab is absent until an admin has authored a gate, so most installs see three. */}
            <TabsList className={`grid w-full flex-shrink-0 ${hasTerms ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              {hasTerms && <TabsTrigger value="terms">Terms</TabsTrigger>}
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Only the panel scrolls; the identity, actions and tab strip stay put. */}
            <TabsContent value="messages" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1 min-h-0 px-1">
                {/* Mounted only while selected, so opening the tab is what triggers the fetch. */}
                <MessagesTab active={showProfileDialog && profileTab === 'messages'} onUnreadChange={onUnreadChange} />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="notifications" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1 min-h-0 px-1">
                {/* Opening it reads the feed, and reading it is what marks it read. */}
                <NotificationsTab
                  active={showProfileDialog && profileTab === 'notifications'}
                  onRead={onNotificationsRead}
                  onOpenListing={onOpenListing && ((item) => onOpenListing({ id: item.id, kind: item.kind }))}
                />
              </ScrollArea>
            </TabsContent>

            {hasTerms && (
              <TabsContent value="terms" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
                <ScrollArea className="flex-1 min-h-0 px-1">
                  <TermsTab active={showProfileDialog && profileTab === 'terms'} />
                </ScrollArea>
              </TabsContent>
            )}

            <TabsContent value="settings" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1 min-h-0 px-1">
                <AccountSettingsTab suspended={isSuspended} onChangePassword={() => setShowPasswordDialog(true)} />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Change Password: opened from the Settings tab. */}
      <Dialog
        open={showPasswordDialog}
        onOpenChange={(open) => { setShowPasswordDialog(open); if (!open) resetPasswordForm(); }}
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
              <p className="text-helper text-muted-foreground">
                Your password can&rsquo;t be changed while your account is suspended.
              </p>
            )}

            {passwordError && (
              <div className="text-label text-destructive p-2 bg-destructive/10 rounded-md">
                {passwordError}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="currentPassword" className="text-label font-medium">Current Password</label>
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
              <label htmlFor="newPassword" className="text-label font-medium">New Password</label>
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
