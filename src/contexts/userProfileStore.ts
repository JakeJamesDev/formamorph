import { createContext, useContext } from 'react';

/** Shows one published listing, wherever the catalog browser happens to live. */
export type ListingOpener = (listing: { id: string; kind: string }) => void;

export interface UserProfileContextValue {
  /**
   * Show somebody's profile.
   *
   * @param userId - Whose. A missing id is ignored rather than opening an empty dialog — a comment can
   *   outlive its author, and their name is left as plain text in that case.
   * @param username - The name already on screen, so the dialog opens with something in it
   */
  openProfile: (userId: string | null | undefined, username?: string | null) => void;
  /**
   * Lend the dialog a way to open a listing, or take it back with null.
   *
   * Registered rather than passed down: the dialog sits at the root so it can open over anything, and
   * the catalog browser it hands off to is owned much further in. Whoever owns the browser lends this
   * while it is mounted, and the rows are plain text whenever nobody has.
   */
  setListingOpener: (open: ListingOpener | null) => void;
}

/** Separate from the provider so that file exports a component and nothing else, which is what keeps
 *  fast refresh working — the alternative is a lint-disable on every context in the tree. */
export const UserProfileContext = createContext<UserProfileContextValue | null>(null);

/**
 * Open somebody's profile from anywhere inside the provider.
 *
 * Outside it, `openProfile` does nothing rather than throwing: a panel rendered in isolation — a test, a
 * screenshot — should still render, and a name that opens no dialog is a smaller failure than a screen
 * that will not mount.
 */
export const useUserProfile = (): UserProfileContextValue =>
  useContext(UserProfileContext) ?? { openProfile: () => {}, setListingOpener: () => {} };
