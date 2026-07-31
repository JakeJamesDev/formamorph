import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { History, Mail, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MessageComposerDialog, type ComposerTarget } from "@/components/menu/MessageComposerDialog";
import { SentMessagesDialog } from "@/components/menu/SentMessagesDialog";
import WorldStorageService from "@/services/WorldStorageService";
import AuthService from "@/services/AuthService";
import { type WorldRecord } from "@/components/WorldDetails";

/** Prefill offered after a suspension, so the user learns why without the admin retyping it. */
const SUSPENSION_TEMPLATE = {
  subject: 'Your account has been suspended',
  body: 'Your account has been suspended.\n\n**Reason:** ',
} as const;

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
  // Bumped after a send so an open sent list picks the new message up.
  const [sentNonce, setSentNonce] = useState(0);

  const adminUsername = String(AuthService.getCurrentUser()?.username || 'Admin');

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

  // Fetch users from the server
  const fetchUsers = async () => {
    if (!active) return;

    const reqId = ++fetchReqRef.current;
    setIsLoadingUsers(true);

    try {
      // Fetch users from the API. Encode the query so a term with & or # can't break the URL.
      const query = new URLSearchParams({ page: String(userCurrentPage), limit: '10', search: userSearchQuery });
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
  }, [active, userCurrentPage, searchNonce]);

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
              <History className="mr-2 h-4 w-4" /> Sent Messages
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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Username
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Account Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {isLoadingUsers ? (
                  Array(5).fill(0).map((_, index) => (
                    <tr key={index}>
                      <td className="px-4 py-4">
                        <Skeleton className="h-4 w-4" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Skeleton className="h-4 w-16" />
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
                          <div className="text-sm font-medium text-foreground">
                            {user.username}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-muted-foreground">
                            {user.email || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-muted-foreground">
                            {user.accountType || "user"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass}`}>
                            {user.status || "active"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
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

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setHistoryUser({ id: userId, username: usernameOf(user) });
                                setShowSentMessages(true);
                              }}
                            >
                              <History className="mr-1 h-3 w-3" /> History
                            </Button>

                            {user.status !== "normal" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-success hover:text-success/80"
                                onClick={() => handleUserStatusChange(userId, "normal")}
                              >
                                Activate
                              </Button>
                            )}

                            {user.status !== "suspended" && (
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

          {/* Pagination */}
          {!isLoadingUsers && users.length > 0 && (
            <div className="flex justify-center gap-2 mt-6">
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
    </>
  );
}
