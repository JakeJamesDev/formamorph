import { useCallback, useMemo, useState, type ReactNode } from "react";
import { UserProfileDialog } from "@/components/community/UserProfileDialog";
import { UserProfileContext } from "@/contexts/userProfileStore";

/**
 * One profile dialog for the whole app, opened from wherever a name appears.
 *
 * Held at the root rather than inside each surface: names are clicked from inside other dialogs — the
 * listing details modal, a feedback thread — and a dialog rendered within another one inherits its
 * scroll lock and its width. One instance above them all sidesteps that entirely, and means a new
 * surface needs a hook call rather than its own copy of this.
 */
export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ id: string; username: string | null } | null>(null);

  const openProfile = useCallback((userId: string | null | undefined, username?: string | null) => {
    if (!userId) return;

    setTarget({ id: userId, username: username ?? null });
  }, []);

  const value = useMemo(() => ({ openProfile }), [openProfile]);

  return (
    <UserProfileContext.Provider value={value}>
      {children}
      <UserProfileDialog
        userId={target?.id ?? null}
        fallbackUsername={target?.username}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
      />
    </UserProfileContext.Provider>
  );
}

