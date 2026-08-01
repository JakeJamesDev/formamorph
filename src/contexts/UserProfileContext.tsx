import { useCallback, useMemo, useState, type ReactNode } from "react";
import { UserProfileDialog } from "@/components/community/UserProfileDialog";
import { UserProfileContext, type ListingOpener } from "@/contexts/userProfileStore";

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
  // Lent by whoever owns the catalog browser, which is mounted far below this. Held in state rather than
  // a ref so the dialog re-renders into working links the moment it arrives.
  const [listingOpener, setListingOpener] = useState<ListingOpener | null>(null);

  const openProfile = useCallback((userId: string | null | undefined, username?: string | null) => {
    if (!userId) return;

    setTarget({ id: userId, username: username ?? null });
  }, []);

  // A function stored in state has to be set through a callback, or React reads the function itself as
  // an updater and calls it.
  const lendListingOpener = useCallback((open: ListingOpener | null) => setListingOpener(() => open), []);

  const openListing = useMemo(() => (
    listingOpener
      ? (listing: { id: string; kind: string }) => {
        // Closed here rather than by the host: this dialog is the one in the way, and the browser
        // underneath is left to decide whether it needs opening or is already open.
        setTarget(null);
        listingOpener(listing);
      }
      : undefined
  ), [listingOpener]);

  const value = useMemo(
    () => ({ openProfile, setListingOpener: lendListingOpener }),
    [openProfile, lendListingOpener]
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
      <UserProfileDialog
        userId={target?.id ?? null}
        fallbackUsername={target?.username}
        onOpenListing={openListing}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
      />
    </UserProfileContext.Provider>
  );
}
