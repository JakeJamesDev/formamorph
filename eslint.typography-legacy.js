// Files still holding raw Tailwind text sizes from before the role-named scale existed. The
// no-restricted-syntax guard in eslint.config.js skips them so new code is held to the rule while the
// sweep happens separately. This list only ever shrinks — never add to it.
//
// The sweep is done: it is empty, and the guard now covers every file outside src/components/ui.
export const TYPOGRAPHY_LEGACY = []
