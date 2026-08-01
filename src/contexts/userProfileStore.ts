import { createContext, useContext } from 'react';

export interface UserProfileContextValue {
  /**
   * Show somebody's profile.
   *
   * @param userId - Whose. A missing id is ignored rather than opening an empty dialog — a comment can
   *   outlive its author, and their name is left as plain text in that case.
   * @param username - The name already on screen, so the dialog opens with something in it
   */
  openProfile: (userId: string | null | undefined, username?: string | null) => void;
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
  useContext(UserProfileContext) ?? { openProfile: () => {} };
