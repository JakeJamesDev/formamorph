import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import WorldStorageService from "@/services/WorldStorageService";
import AuthService from "@/services/AuthService";
import { type WorldRecord } from "@/components/WorldDetails";

interface ManageUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Admin dialog for listing and activating/suspending user accounts. Owns its own paging/search state;
 *  the parent only controls whether it is open. Refetches when opened or when the page changes. */
export function ManageUsersDialog({ open, onOpenChange }: ManageUsersDialogProps) {
  const [users, setUsers] = useState<WorldRecord[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);

  // Fetch users from the server
  const fetchUsers = async () => {
    if (!open) return;

    setIsLoadingUsers(true);

    try {
      // Fetch users from the API
      const response = await fetch(`${WorldStorageService.API_URL}/users?page=${userCurrentPage}&limit=10&search=${userSearchQuery}`, {
        headers: {
          'Authorization': `Bearer ${AuthService.token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch users');
      }

      const result = await response.json();

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
      toast.error((error as Error).message || 'Failed to connect to server');
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
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
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${newStatus === "normal" ? "activate" : "suspend"} user`);
      }

      // Update the user in the list
      setUsers(prev => prev.map(user =>
        user._id === userId ? { ...user, status: newStatus } : user
      ));

      toast.success(`User ${newStatus === "normal" ? "activated" : "suspended"} successfully`);
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error((error as Error).message || `Failed to ${newStatus === "normal" ? "activate" : "suspend"} user`);
    }
  };

  // Fetch users when the dialog is opened or the page changes
  useEffect(() => {
    if (open) {
      fetchUsers();
    }
    // Fetch only when the dialog opens or the page changes — not on fetchUsers identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userCurrentPage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[85vh] overflow-y-auto flex flex-col items-start">
        <DialogHeader>
          <DialogTitle>Manage Users</DialogTitle>
          <DialogDescription>
            View and manage user accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 w-full">
          {/* Search controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                className="pl-8"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setUserCurrentPage(1);
                    fetchUsers();
                  }
                }}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUserCurrentPage(1);
                fetchUsers();
              }}
            >
              Search
            </Button>
          </div>

          {/* Users table */}
          <div className="w-full overflow-hidden border rounded-lg">
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Username
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Account Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {isLoadingUsers ? (
                  Array(5).fill(0).map((_, index) => (
                    <tr key={index}>
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
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    // Get the user ID (server uses _id)
                    const userId = user._id || user.id;

                    // Determine status badge color
                    let statusBadgeClass = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
                    if (user.status === "suspended") {
                      statusBadgeClass = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
                    } else if (user.status === "pending") {
                      statusBadgeClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
                    }

                    return (
                      <tr key={userId}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {user.username}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.accountType || "user"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass}`}>
                            {user.status || "active"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            {user.status !== "normal" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                onClick={() => handleUserStatusChange(userId, "normal")}
                              >
                                Activate
                              </Button>
                            )}

                            {user.status !== "suspended" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
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
      </DialogContent>
    </Dialog>
  );
}
