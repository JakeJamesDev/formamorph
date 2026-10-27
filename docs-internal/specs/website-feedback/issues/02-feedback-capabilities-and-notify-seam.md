# 02: Feedback Capabilities and Notify Seam

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: a prefactor across the feedback dialog, list and thread view. It must keep app behavior identical while it opens two seams the website needs.

**What to build:** the app's feedback components (hub, list, thread view, filing form, edit dialog) take a feedback capabilities object and a required `notify(message, kind)` callback, the same pattern as the community browser's capabilities and the avatar editor's `notify`. The app passes a full capabilities set and a toast-backed `notify`, so nothing a player sees changes. The website set (ticket 03) will turn off the bug tab, bug filing, staff controls and the unread badge, and will mark the reader as a guest so write controls call a supplied sign-in handler.

- [x] An app-wide capabilities constant and a website capabilities constant exist beside each other, each documented in one line. `src/lib/feedbackCapabilities.ts`.
- [x] Capabilities are flags only: which boards show, which types can be filed, staff controls, the unread badge. Guest mode is a separate optional `onGuestWrite` prop; present means guest, and Vote, Comment and New call it. (Spec-session ruling.) `feedbackCapabilities.test.tsx` guest board and thread cases.
- [x] `notify` takes an optional error: `notify(message, kind, error?)`. The app routes an error to the same toast with its Error Details link as today. (Spec-session ruling.) `toastFeedbackNotify` calls `toastError(error, message)`; every message string matches the old toast text (spec review).
- [x] With staff controls off, a staff viewer is treated as a normal player: no status, lock, delete thread, deleting others' comments, replying on a locked thread, or refile. The asker's own Accept Answer stays. (Spec-session ruling.) "treats a staff reader as a player" (with an app-set control) and "keeps the asker's own Accept Answer"; locked-reply and refile follow from the role-free viewer, verified by reading.
- [x] The reused feedback components import no toast library; every result goes through `notify`. `feedbackCapabilities.test.tsx` › "imports no toast library", six components.
- [x] `notify` is required, not defaulted, so no call site reports into nothing. Required prop; typecheck failed on every call site until each passed one.
- [x] With the website set and guest mode, a jsdom render shows no bug tab, no staff controls, and Vote, Comment and New call the sign-in handler instead of the service. `feedbackCapabilities.test.tsx`; guards mutation-tested.
- [x] The existing feedback dialog, list, thread view and edit tests stay green with no assertion weakened. The diffs only add `notify`; 950 tests in `src/components/menu` + dev + ErrorDetails green.

## Landed

**Not verified:** none. Locked-thread reply and refile under staff controls off are verified by reading, not by a dedicated test.

**For you:**
- Open the Feedback hub in the app and file, vote and reply once: the toasts and their View Details link should read as before.
- The guest reply control reads "Sign In to Reply": new copy for ticket 03 to confirm.
