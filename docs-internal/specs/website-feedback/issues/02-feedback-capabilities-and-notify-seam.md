# 02: Feedback Capabilities and Notify Seam

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: a prefactor across the feedback dialog, list and thread view. It must keep app behavior identical while it opens two seams the website needs.

**What to build:** the app's feedback components (hub, list, thread view, filing form, edit dialog) take a feedback capabilities object and a required `notify(message, kind)` callback, the same pattern as the community browser's capabilities and the avatar editor's `notify`. The app passes a full capabilities set and a toast-backed `notify`, so nothing a player sees changes. The website set (ticket 03) will turn off the bug tab, bug filing, staff controls and the unread badge, and will mark the reader as a guest so write controls call a supplied sign-in handler.

- [ ] An app-wide capabilities constant and a website capabilities constant exist beside each other, each documented in one line.
- [ ] Capabilities cover: which boards show, which types can be filed, staff controls, the unread badge, and a guest mode with a sign-in handler for Vote, Comment and New.
- [ ] The reused feedback components import no toast library; every result goes through `notify`.
- [ ] `notify` is required, not defaulted, so no call site reports into nothing.
- [ ] With the website set and guest mode, a jsdom render shows no bug tab, no staff controls, and Vote, Comment and New call the sign-in handler instead of the service.
- [ ] The existing feedback dialog, list, thread view and edit tests stay green with no assertion weakened.
