/**
 * What the app asks before a player leaves something they would lose. One copy each, because two routes
 * out of the same place must not word the question differently.
 */

/** Leaving a playthrough: the in-game Exit, and the Android back button. */
export const EXIT_TO_MENU_PROMPT = {
  title: 'Exit to Main Menu',
  description: 'Are you sure you want to exit to the main menu? Any unsaved progress will be lost.',
} as const;

/** Closing the Android app from its first screen. */
export const CLOSE_APP_PROMPT = {
  title: 'Close Formamorph',
  description: 'Are you sure you want to close the app? Any unsaved progress will be lost.',
} as const;
