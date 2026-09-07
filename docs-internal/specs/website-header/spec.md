# Consistent website header

Status: ready-for-human

## Decision

Design A (inline wordmark) was selected: a 64px header with the brand and underlined Community navigation on the left, and the avatar on the right. Landing, privacy, account, and community pages use one header component and stylesheet.

The account menu includes Profile, Account Settings, Light/Dark/System appearance, and Sign Out. Appearance uses the app's theme provider and saved preference, including device changes and cross-tab updates.

The website catalog defaults to Likes descending. The shared sorting pipeline remembers subsequent choices in a website preference namespace, independent of app browsing preferences.

## Prototype source

Branch `codex/prototype-site-header`, commit `7127b98f`, file `site/prototype/header.html`, preserves the three alternatives and page comparisons. The prototype remains outside the production branch.

## Verification

- Typecheck: exit 0 (15.0s). Lint: exit 0 (11.9s).
- Full unit suite: 8,467 passed, 3 skipped, exit 0 (58.2s); the separate prototype worktree was excluded.
- Final browser navigation checks: 16 passed, exit 0 (54.5s), at 1280px and 375px widths. Landing/privacy/account menus match in geometry, type size, weight, and color. Device theme changes preserve System selection. Community ordering and Like hover/fill pass in both themes.
- Landing and account regression scenarios also passed after updating the avatar-menu assertions and using dedicated cross-tab test servers.
- Production builds: app exit 0 (19.3s), website exit 0 (7.5s).
- Focused line coverage: header/account controls 100%, shared theme provider 98.4%, sorting/filter pipeline 78.1%. The focused filter run covers sorting; unrelated hide/filter actions remain covered by the full existing suite. The provider's storage-read fallback was not exercised in the focused run.
- Mutation checks caught broken theme persistence, removed cross-tab subscription, and the wrong initial sort; all sources were restored before final checks.
- No world/save export shape or version changes. Changelog updated; graph rebuilt.
