import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, History, ImageOff, Mail, RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { RoleBadge } from "@/components/RoleBadge";
import { ASSIGNABLE_ROLES, ROLE_LABELS, canModerate, isAdmin, roleOf, type Role } from "@/lib/roles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageComposerDialog, type ComposerTarget } from "@/components/menu/MessageComposerDialog";
import { SentMessagesDialog } from "@/components/menu/SentMessagesDialog";
import PolicyService from "@/services/PolicyService";
import WorldStorageService from "@/services/WorldStorageService";
import AuthService from "@/services/AuthService";
import MessageService from "@/services/MessageService";
import { type WorldRecord } from "@/components/WorldDetails";
import type { SentMessage } from "@/types";

/** Prefill offered after a suspension, so the user learns why without the admin retyping it. */
const SUSPENSION_TEMPLATE = {
  subject: 'Your account has been suspended',
  body: 'Your account has been suspended.\n\n**Reason:** ',
} as const;

/** Prefill offered after clearing somebody's picture, so they learn why rather than just finding it gone. */
const AVATAR_REMOVAL_TEMPLATE = {
  subject: 'Your profile image has been removed',
  body: 'Your profile image has been removed from Formamorph. You can upload a new one from your profile at any time.\n\n**Reason:** ',
} as const;

/** How each answer to the upload gate reads in the table. */
const TERMS_LABELS = {
  unanswered: { label: 'Not Seen', className: 'text-muted-foreground' },
  declined: { label: 'Declined', className: 'text-destructive' },
  accepted: { label: 'Accepted', className: 'text-success' },
} as const;

type TermsResponse = keyof typeof TERMS_LABELS;

/** A row's answer, defaulting anything unrecognized to unanswered rather than showing nothing. */
const termsResponseOf = (user: WorldRecord): TermsResponse =>
  user.termsResponse in TERMS_LABELS ? (user.termsResponse as TermsResponse) : 'unanswered';

/** Sortable columns, in table order. Actions holds controls rather than data, so it isn't one. */
const SORT_COLUMNS = [
  { key: 'username', label: 'Username' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'terms', label: 'Terms' },
] as const;

type SortKey = (typeof SORT_COLUMNS)[number]['key'];
type SortOrder = 'asc' | 'desc';

interface ManageUsersTabProps {
  /** Whether the tab is visible; drives the fetch so a hidden tab isn't loading users. */
  active: boolean;
}

/** Admin Panel → Users. Lists accounts, activates/suspends them, and sends direct messages. Owns its own
 *  paging/search state; broadcasts live in their own tab. */
export function ManageUsersTab({ active }: ManageUsersTabProps) {
  const [users, setUsers] = useState<WorldRecord[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  // Bumped to (re)run a search even when the page is already 1 (where a page reset wouldn't change state).
  const [searchNonce, setSearchNonce] = useState(0);
  // Sorting is server-side: the table is paged, so ordering the rows in hand would sort one page.
  // Null means the server's own default, newest signup first.
  const [sort, setSort] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  // Every direct message ever sent, for the All Messages button — not just this page's worth.
  const [directTotal, setDirectTotal] = useState(0);
  // Tokens each fetch so a stale one can't overwrite the table (page change / re-search mid-flight).
  const fetchReqRef = useRef(0);

  // Selection carries id → username rather than ids alone: it survives paging and re-searching, and a
  // user picked on an earlier page is no longer on screen to look their name up from at send time.
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [composerTarget, setComposerTarget] = useState<ComposerTarget | null>(null);
  const [composerPrefill, setComposerPrefill] = useState<{ subject: string; body: string } | null>(null);
  // Offered after a suspension lands; declining leaves the suspension in place either way.
  const [suspendedUser, setSuspendedUser] = useState<WorldRecord | null>(null);
  // The sent list serves both entry points: unfiltered, or narrowed to one user via `historyUser`.
  const [showSentMessages, setShowSentMessages] = useState(false);
  const [historyUser, setHistoryUser] = useState<{ id: string; username: string } | null>(null);
  // Confirmed before it happens, then offered as a notice afterwards — the same two beats a suspension
  // and a takedown already have.
  const [pendingAvatarRemoval, setPendingAvatarRemoval] = useState<WorldRecord | null>(null);
  const [avatarRemovedFrom, setAvatarRemovedFrom] = useState<WorldRecord | null>(null);
  // Set to the sent message being rewritten; the composer serves both send and edit.
  const [editingMessage, setEditingMessage] = useState<SentMessage | null>(null);
  // Bumped after a send so an open sent list picks the new message up.
  const [sentNonce, setSentNonce] = useState(0);
  // Set to the user whose upload-terms acceptance is about to be cleared.
  const [pendingTermsReset, setPendingTermsReset] = useState<WorldRecord | null>(null);

  const adminUsername = String(AuthService.getCurrentUser()?.username || 'Admin');
  // Changing what somebody *is* belongs to an administrator; the rest of this table is any staff's.
  const viewer = AuthService.getCurrentUser();
  const viewerIsAdmin = isAdmin(viewer);
  /** Whether the signed-in account may act on this row at all — staff moderate the room, not each other. */
  const mayModerate = (user: WorldRecord) => canModerate(viewer, user);

  const userIdOf = (user: WorldRecord) => String(user._id || user.id);
  const usernameOf = (user: WorldRecord) => String(user.username || 'user');

  const toggleSelected = (user: WorldRecord) => {
    const userId = userIdOf(user);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(userId)) next.delete(userId);
      else next.set(userId, usernameOf(user));
      return next;
    });
  };

  const allOnPageSelected = users.length > 0 && users.every((user) => selected.has(userIdOf(user)));

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allOnPageSelected) users.forEach((user) => next.delete(userIdOf(user)));
      else users.forEach((user) => next.set(userIdOf(user), usernameOf(user)));
      return next;
    });
  };

  const selectedRecipients = [...selected].map(([id, username]) => ({ id, username }));

  // Nothing on screen yet, so there is nothing to dim — the skeleton is the only thing to show.
  const isFirstLoad = isLoadingUsers && users.length === 0;
  // A reload of rows already on screen: dim them in place instead.
  const isRefreshing = isLoadingUsers && users.length > 0;

  // Fetch users from the server
  const fetchUsers = async () => {
    if (!active) return;

    const reqId = ++fetchReqRef.current;
    setIsLoadingUsers(true);

    try {
      // Fetch users from the API. Encode the query so a term with & or # can't break the URL.
      const query = new URLSearchParams({ page: String(userCurrentPage), limit: '10', search: userSearchQuery });
      if (sort) {
        query.set('sort', sort);
        query.set('order', sortOrder);
      }
      const response = await fetch(`${WorldStorageService.API_URL}/users?${query}`, {
        headers: {
          'Authorization': `Bearer ${AuthService.token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch users');
      }

      const result = await response.json();
      if (reqId !== fetchReqRef.current) return; // superseded by a newer fetch (page change / re-search)

      if (result.success) {
        setUsers(result.data);

        // Calculate total pages
        const total = result.total || 0;
        const pages = Math.ceil(total / 10);
        setUserTotalPages(pages > 0 ? pages : 1);
      } else {
        console.error('Error fetching users:', result.error);
        toast.error(result.error || 'Failed to fetch users');
        setUsers([]);
      }
    } catch (error) {
      console.error('Error in fetchUsers:', error);
      if (reqId === fetchReqRef.current) {
        toast.error((error as Error).message || 'Failed to connect to server');
        setUsers([]);
      }
    } finally {
      if (reqId === fetchReqRef.current) setIsLoadingUsers(false);
    }
  };

  // Handle user status change
  const handleUserStatusChange = async (userId: string, newStatus: string) => {
    try {
      // Call API to update user status - use the same endpoint for both actions
      const endpoint = `${WorldStorageService.API_URL}/users/${userId}/status`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AuthService.token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        // This API answers with `error`, not `message`.
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || `Failed to ${newStatus === "normal" ? "activate" : "suspend"} user`);
      }

      // Update the user in the list. Matched through `userIdOf`, not `user._id` alone: this endpoint
      // returns `id`, so an `_id`-only comparison never matched and the row's buttons kept showing the
      // old status until a search refetched the table.
      setUsers(prev => prev.map(user =>
        userIdOf(user) === userId ? { ...user, status: newStatus } : user
      ));

      toast.success(`User ${newStatus === "normal" ? "activated" : "suspended"} successfully`);

      // The suspension itself has already landed; the notice is an optional follow-up so the user
      // learns why. Declining leaves them suspended and simply unexplained.
      if (newStatus === "suspended") {
        const suspended = users.find((user) => userIdOf(user) === userId);
        if (suspended) setSuspendedUser(suspended);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error((error as Error).message || `Failed to ${newStatus === "normal" ? "activate" : "suspend"} user`);
    }
  };

  // Fetch users when the dialog opens, the page changes, or a search is triggered. Driving the search
  // through state (not a direct call) means one fetch with the current page/query — no stale-page double
  // fetch. React batches the page-reset + nonce bump into a single render, so this fires exactly once.
  useEffect(() => {
    if (active) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userCurrentPage, searchNonce, sort, sortOrder]);

  // The count on the All Messages button. Refreshed after a send, and cheap: one row is asked for and
  // only the total read off it.
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    MessageService.fetchSent({ page: 1, limit: 1, audience: 'direct' })
      .then((result) => { if (!cancelled) setDirectTotal(result.total); })
      // A missing count leaves the button unlabeled rather than breaking the tab.
      .catch((error) => console.error('Failed to count sent messages:', error));

    return () => { cancelled = true; };
  }, [active, sentNonce]);

  /** Take over a column, or flip it when it is already the one being sorted by. */
  const sortBy = (key: SortKey) => {
    setSortOrder((prev) => (sort === key && prev === 'asc' ? 'desc' : 'asc'));
    setSort(key);
    // The rows on page three of a name sort are not the rows on page three of a status sort.
    setUserCurrentPage(1);
  };

  /**
   * Promote or demote one account.
   *
   * Administrators are deliberately absent from both ends: one is made by hand on the server, and an
   * existing one cannot be changed from here, so the dropdown never offers either.
   */
  const changeRole = async (user: WorldRecord, accountType: Role) => {
    const previous = roleOf(user);
    if (accountType === previous) return;

    try {
      const response = await fetch(`${WorldStorageService.API_URL}/users/${userIdOf(user)}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AuthService.token}`
        },
        body: JSON.stringify({ accountType }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to change the account type');
      }

      // Written into the row rather than refetched, so the badge and the moderation controls on it
      // follow immediately — a demoted moderator becomes actionable in place.
      setUsers((prev) => prev.map((row) =>
        userIdOf(row) === userIdOf(user) ? { ...row, accountType } : row
      ));

      toast.success(accountType === 'normal'
        ? `${usernameOf(user)} is a normal account again`
        : `${usernameOf(user)} is now a ${ROLE_LABELS[accountType].toLowerCase()}`);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to change the account type');
    }
  };

  /** Clear one user's acceptance, so the gate is shown to them again on their next publish. */
  const resetTerms = async (user: WorldRecord) => {
    try {
      await PolicyService.resetUploadGate(userIdOf(user));
      // Reflect it in the row rather than waiting for a refetch, so the reset button disables itself.
      setUsers((prev) => prev.map((row) =>
        userIdOf(row) === userIdOf(user) ? { ...row, termsResponse: 'unanswered' } : row
      ));
      toast.success(`${usernameOf(user)} will be asked to accept the terms again`);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to reset the terms');
    }
  };

  /** Clear one user's profile image, then offer to tell them why. */
  const removeAvatar = async (user: WorldRecord) => {
    try {
      await AuthService.removeUserAvatar(userIdOf(user));
      // Cleared in the row rather than refetched, so the control disappears with the picture.
      setUsers((prev) => prev.map((row) =>
        userIdOf(row) === userIdOf(user) ? { ...row, avatarUrl: null } : row
      ));
      toast.success(`Removed the profile image of ${usernameOf(user)}`);
      setAvatarRemovedFrom(user);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to remove the profile image');
    }
  };

  const runSearch = () => {
    setUserCurrentPage(1);
    setSearchNonce((n) => n + 1);
  };

  return (
    <>
      <div className="py-4 w-full min-w-0">
          {/* Search controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-8"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    runSearch();
                  }
                }}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={runSearch}
            >
              Search
            </Button>
          </div>

          {/* Message actions: the current selection, or the direct-message history. */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => { setComposerPrefill(null); setComposerTarget({ broadcast: false, recipients: selectedRecipients }); }}
            >
              <Mail className="mr-2 h-4 w-4" />
              Message Selected{selected.size > 0 ? ` (${selected.size})` : ''}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setHistoryUser(null); setShowSentMessages(true); }}
            >
              <History className="mr-2 h-4 w-4" /> All Messages ({directTotal})
            </Button>

            {selected.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())}>
                Clear Selection
              </Button>
            )}
          </div>

          {/* Users table */}
          <div className="w-full overflow-hidden border rounded-lg">
            <table className="w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={togglePage}
                      aria-label="Select all users on this page"
                    />
                  </th>
                  {SORT_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      // Tells a screen reader which way the table is ordered, and by which column.
                      aria-sort={sort === column.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        className="flex items-center gap-1 uppercase tracking-wider hover:text-foreground"
                        onClick={() => sortBy(column.key)}
                      >
                        {column.label}
                        {sort === column.key
                          ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                          : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              {/* A refetch dims the rows in place rather than swapping them for a skeleton: the
                  skeleton is a different height and a fixed five rows, so sorting or paging a full page
                  collapsed the table and sprang it back. The skeleton is only for the first load, when
                  there is nothing to dim. */}
              <tbody
                className={`bg-background divide-y divide-border transition-opacity${
                  isRefreshing ? ' opacity-50 pointer-events-none' : ''
                }`}
                aria-busy={isLoadingUsers}
              >
                {isFirstLoad ? (
                  Array(5).fill(0).map((_, index) => (
                    <tr key={index}>
                      <td className="px-4 py-4">
                        <Skeleton className="h-4 w-4" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-8 w-20" />
                      </td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    // Get the user ID (server uses _id)
                    const userId = user._id || user.id;

                    // Determine status badge color
                    let statusBadgeClass = "bg-success/10 text-success";
                    if (user.status === "suspended") {
                      statusBadgeClass = "bg-destructive/10 text-destructive";
                    } else if (user.status === "pending") {
                      statusBadgeClass = "bg-warning/10 text-warning";
                    }

                    return (
                      <tr key={userId}>
                        <td className="px-4 py-4">
                          <Checkbox
                            checked={selected.has(userId)}
                            onCheckedChange={() => toggleSelected(user)}
                            aria-label={`Select ${user.username}`}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <UserAvatar
                              username={user.username as string | undefined}
                              avatarUrl={user.avatarUrl as string | null | undefined}
                              size="sm"
                            />
                            <span className="truncate">{user.username}</span>
                            <RoleBadge role={user.accountType as string | null | undefined} />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {viewerIsAdmin && roleOf(user) !== 'admin' ? (
                            <Select
                              value={roleOf(user)}
                              onValueChange={(value) => changeRole(user, value as Role)}
                            >
                              <SelectTrigger className="h-8 w-[110px]" aria-label={`Role for ${usernameOf(user)}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ASSIGNABLE_ROLES.map((role) => (
                                  <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            /* An administrator is made on the server and nowhere else, so there is nothing
                               to offer here — and a moderator changes nobody. */
                            <div className="text-sm text-muted-foreground">
                              {ROLE_LABELS[roleOf(user)]}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass}`}>
                            {user.status || "active"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {/* Only an answer given against the current wording counts, so someone whose
                              acceptance a change invalidated reads as Not Seen — which is what the gate
                              will treat them as. Nothing to reset unless they answered. */}
                          <div className="flex items-center gap-1">
                            <span className={`text-sm ${TERMS_LABELS[termsResponseOf(user)].className}`}>
                              {TERMS_LABELS[termsResponseOf(user)].label}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Reset terms"
                              aria-label={`Reset terms for ${usernameOf(user)}`}
                              disabled={termsResponseOf(user) === 'unanswered' || !mayModerate(user)}
                              onClick={() => setPendingTermsReset(user)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-wrap gap-2">
                            {/* Split button, as the in-game Re-generate one: the common action on the
                                left, the rarer one behind the caret, for one button's worth of row width. */}
                            <div className="flex">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-r-none"
                                aria-label={`Message ${usernameOf(user)}`}
                                onClick={() => {
                                  setComposerPrefill(null);
                                  setComposerTarget({
                                    broadcast: false,
                                    recipients: [{ id: userId, username: usernameOf(user) }],
                                  });
                                }}
                              >
                                <Mail className="mr-1 h-3 w-3" /> Message
                              </Button>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-l-none border-l-0 px-2"
                                    aria-label={`More message options for ${usernameOf(user)}`}
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </PopoverTrigger>
                                {/* `PopoverClose`: the action opens a dialog, and a popover left open
                                    behind it would still be there when the dialog closes. */}
                                <PopoverContent align="start" className="w-40 p-1">
                                  <PopoverClose asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="w-full justify-start"
                                      onClick={() => {
                                        setHistoryUser({ id: userId, username: usernameOf(user) });
                                        setShowSentMessages(true);
                                      }}
                                    >
                                      <History className="mr-2 h-3.5 w-3.5" /> History ({Number(user.messageCount) || 0})
                                    </Button>
                                  </PopoverClose>

                                  {/* Only when there is one, and only on somebody this viewer may act on:
                                      an inert row would read as a missing permission. */}
                                  {user.avatarUrl && mayModerate(user) ? (
                                    <PopoverClose asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="w-full justify-start text-destructive hover:text-destructive"
                                        aria-label={`Remove the profile image of ${usernameOf(user)}`}
                                        onClick={() => setPendingAvatarRemoval(user)}
                                      >
                                        <ImageOff className="mr-2 h-3.5 w-3.5" /> Remove Image
                                      </Button>
                                    </PopoverClose>
                                  ) : null}
                                </PopoverContent>
                              </Popover>
                            </div>

                            {user.status !== "normal" && mayModerate(user) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-success hover:text-success/80"
                                onClick={() => handleUserStatusChange(userId, "normal")}
                              >
                                Activate
                              </Button>
                            )}

                            {user.status !== "suspended" && mayModerate(user) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive/80"
                                onClick={() => handleUserStatusChange(userId, "suspended")}
                              >
                                Suspend
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination. Kept mounted through a reload and dimmed with the rows — unmounting it on every
              refetch took the whole row out of the layout and put it back, which read as a flash. */}
          {users.length > 0 && (
            <div
              className={`flex justify-center gap-2 mt-6 transition-opacity${
                isRefreshing ? ' opacity-50 pointer-events-none' : ''
              }`}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newPage = Math.max(userCurrentPage - 1, 1);
                  setUserCurrentPage(newPage);
                }}
                disabled={userCurrentPage <= 1}
              >
                Previous
              </Button>

              <span className="px-4 py-2 text-sm">
                Page {userCurrentPage} of {userTotalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newPage = Math.min(userCurrentPage + 1, userTotalPages);
                  setUserCurrentPage(newPage);
                }}
                disabled={userCurrentPage >= userTotalPages}
              >
                Next
              </Button>
            </div>
          )}
      </div>

      {composerTarget && (
      <MessageComposerDialog
        open
        onOpenChange={(isOpen) => { if (!isOpen) { setComposerTarget(null); setComposerPrefill(null); } }}
        target={composerTarget}
        adminUsername={adminUsername}
        initialSubject={composerPrefill?.subject}
        initialBody={composerPrefill?.body}
        initialSeverity={composerPrefill ? 'urgent' : 'info'}
        initialScope={composerPrefill ? 'pinned' : 'existing'}
        onSent={() => setSentNonce((n) => n + 1)}
      />
    )}

    <SentMessagesDialog
      open={showSentMessages}
      onOpenChange={setShowSentMessages}
      userId={historyUser?.id}
      username={historyUser?.username}
      refreshNonce={sentNonce}
      onEdit={setEditingMessage}
    />

    {/* An edit reuses the composer, addressed to whoever the message went to. */}
    {editingMessage && (
      <MessageComposerDialog
        open
        onOpenChange={(isOpen) => { if (!isOpen) setEditingMessage(null); }}
        target={{
          broadcast: false,
          recipients: editingMessage.recipient
            ? [{ id: editingMessage.recipient.id, username: editingMessage.recipient.username ?? 'user' }]
            : [],
        }}
        adminUsername={adminUsername}
        editing={editingMessage}
        onSent={() => setSentNonce((n) => n + 1)}
      />
    )}

    <ConfirmDialog
      open={pendingTermsReset !== null}
      onOpenChange={(isOpen) => { if (!isOpen) setPendingTermsReset(null); }}
      title="Ask this user to accept the terms again?"
      description={`${pendingTermsReset ? usernameOf(pendingTermsReset) : ''} will have to accept the upload gate before publishing anything again, including updates to work they already published.`}
      onConfirm={() => {
        if (pendingTermsReset) resetTerms(pendingTermsReset);
        setPendingTermsReset(null);
      }}
      onCancel={() => setPendingTermsReset(null)}
    />

    <ConfirmDialog
      open={suspendedUser !== null}
      onOpenChange={(isOpen) => { if (!isOpen) setSuspendedUser(null); }}
      title="Send a suspension notice?"
      description={`${suspendedUser?.username} has been suspended. Send them a message explaining why?`}
      onConfirm={() => {
        if (suspendedUser) {
          setComposerPrefill({ ...SUSPENSION_TEMPLATE });
          setComposerTarget({
            broadcast: false,
            recipients: [{ id: userIdOf(suspendedUser), username: usernameOf(suspendedUser) }],
          });
        }
        setSuspendedUser(null);
      }}
      onCancel={() => setSuspendedUser(null)}
    />

    <ConfirmDialog
      open={pendingAvatarRemoval !== null}
      onOpenChange={(isOpen) => { if (!isOpen) setPendingAvatarRemoval(null); }}
      title="Remove this profile image?"
      description={`${pendingAvatarRemoval ? usernameOf(pendingAvatarRemoval) : ''} will go back to a plain initial, and can upload a new picture at any time. This is recorded in the log.`}
      onConfirm={() => {
        if (pendingAvatarRemoval) removeAvatar(pendingAvatarRemoval);
        setPendingAvatarRemoval(null);
      }}
      onCancel={() => setPendingAvatarRemoval(null)}
    />

    <ConfirmDialog
      open={avatarRemovedFrom !== null}
      onOpenChange={(isOpen) => { if (!isOpen) setAvatarRemovedFrom(null); }}
      title="Say why?"
      description={`${avatarRemovedFrom ? usernameOf(avatarRemovedFrom) : ''} has had their profile image removed. Send them a message explaining why?`}
      onConfirm={() => {
        if (avatarRemovedFrom) {
          setComposerPrefill({ ...AVATAR_REMOVAL_TEMPLATE });
          setComposerTarget({
            broadcast: false,
            recipients: [{ id: userIdOf(avatarRemovedFrom), username: usernameOf(avatarRemovedFrom) }],
          });
        }
        setAvatarRemovedFrom(null);
      }}
      onCancel={() => setAvatarRemovedFrom(null)}
    />
    </>
  );
}
