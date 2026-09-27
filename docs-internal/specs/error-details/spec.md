# Spec: Error Details on Every Error Toast

Status: ready-for-agent
Status note: Ten tickets in issues/; 01 gates the rest, 06 follows 05. Ticket 10 covers the four sites the first sweeps missed. The pattern shipped for the ComfyUI rejection in commit f796062b; this spec extends it to every error toast.
Spec session: error-details — spec

## Problem Statement

When something fails, the player sees a toast and nothing else. The toast often hides the cause:

| What the player sees | What the app knew and threw away |
|---|---|
| "Failed to process AI request" | The server's status and its own reason, such as "model not found" or "context length exceeded" |
| An image provider's "HTTP 400" | The provider's response body, which names the bad setting |
| "Failed to save" and other fixed messages | The caught error, discarded before the toast |
| A server message from Community Creations | The route and the status that failed |

About 150 error toasts exist. About 60 of them show a fixed message and discard the caught error. When a player asks for help on Discord or files a bug report, they can only retype the toast. We can't tell which request failed, which server answered, or which version they run. Each report turns into a round of follow-up questions, and many never get answered.

## Solution

Every error toast that comes from a caught error keeps its short message and adds a **View Details →** link. The link opens **Error Details**, a window that shows:

- the toast's message
- the cause: the server's reason, the failing node, or the error's own message
- the raw server response, when there is one
- the error's name, its cause chain and the top of its stack
- the Formamorph version, the platform and the system

The window has two buttons:

- **Copy** puts all of it on the clipboard, ready to paste into Discord.
- **Report Bug** opens the bug report with the error already filled in. A signed-out player signs in first, then lands on the filled-in report.

The toast and the window look and behave the same everywhere: in the main menu, in the World Editor and in play.

## User Stories

1. As a player, I want an error toast to stay short, so that it doesn't cover the game with text I may not need.
2. As a player, I want a **View Details →** link on every error toast, so that I can find out what went wrong when I want to.
3. As a player, I want Error Details to show the real cause of a failed AI request, so that I can fix the setting myself.
4. As a player, I want Error Details to show the AI server's own reason, such as "model not found", so that I know whether the model name, the endpoint or the key is wrong.
5. As a player, I want Error Details to show the HTTP status of a failed request, so that a helper can tell an auth failure from a server crash.
6. As a player using ComfyUI, I want each failing node and its reason listed, so that I know which node to fix.
7. As a player using InvokeAI, Automatic1111 or OpenAI images, I want the provider's response body in Error Details, so that I can see which setting it refused.
8. As a player, I want the raw server response in Error Details, so that nothing the server said is hidden from me or from whoever helps me.
9. As a player, I want a toast that used to say only "Failed to save" to still say that, so that the message stays in plain words.
10. As a player, I want the error behind a plain message like "Failed to save" in Error Details, so that the plain message doesn't hide the cause.
11. As a player, I want the Formamorph version, platform and system in Error Details, so that I don't have to look them up when asked.
12. As a player, I want a **Copy** button, so that I can paste the whole error into Discord in one step.
13. As a player, I want Copy to include the message, the details and the version block, so that one paste answers the first round of questions.
14. As a player, I want a "Copied" confirmation, so that I know the clipboard has it.
15. As a player on an insecure page, I want a clear message when copying fails, so that I know to select the text by hand.
16. As a player, I want to select the details text by hand, so that I can copy part of it.
17. As a player, I want long details to scroll inside the window, so that the Copy button stays in view.
18. As a signed-in player, I want a **Report Bug** button in Error Details, so that I can file the error without leaving the app.
19. As a signed-in player, I want the bug report's title and description filled in from the error, so that I only add what I was doing.
20. As a signed-in player, I want the bug report to keep its own version and platform block, so that the report doesn't show them twice.
21. As a signed-out player, I want Report Bug to ask me to sign in first, so that I can still report the error.
22. As a signed-out player, I want to land on the filled-in bug report after I sign in, so that I don't lose the error.
23. As a signed-out player who cancels sign-in, I want Error Details to stay open, so that I can still copy the error.
24. As a player, I want a bug report I started earlier and didn't send to not overwrite the error I'm reporting now, so that I report the right thing.
25. As a player, I want details too long for a bug report to be cut with a note, so that the report still sends.
26. As a player, I want Error Details to stay open after the toast closes, so that reading the details doesn't race the toast's timer.
27. As a player, I want clicking **View Details →** to leave the toast open, so that I can come back to it.
28. As a player, I want Error Details to close with its X, with Escape or by clicking outside it, so that it works like every other window.
29. As a player, I want my API key never to appear in Error Details, so that pasting the details in public is safe.
30. As a player, I want keys and tokens in an endpoint URL hidden in Error Details, so that a key in a query string doesn't leak.
31. As a player, I want a form's own validation toast, such as "A title is required", to stay without a link, so that simple guidance isn't dressed up as a failure.
32. As a player, I want a canceled request to show no error toast, so that stopping a request isn't reported as a failure.
33. As a player, I want the "Couldn't reach your AI server" toast to keep its **Fix connection →** link, so that the connection guide stays one click away.
34. As a player, I want Error Details to follow the light and dark theme, so that it matches the rest of the app.
35. As a player on a phone, I want Error Details to fit the screen, so that I can read and copy it on mobile.
36. As a player in the World Editor, I want the same View Details link on its errors, so that editor failures are as easy to report as game failures.
37. As a player in Community Creations, I want failed server actions to show the route and status in Error Details, so that the team can find the failing request.
38. As a staff member, I want a pasted error to name the version, the platform and the failing request, so that I can reproduce it without follow-up questions.
39. As a staff member, I want bug reports filed from Error Details to carry the details in their description, so that the report is complete when it arrives.
40. As a developer, I want one way to raise an error toast, so that every new failure gets View Details without extra work.
41. As a developer, I want a thrown error to carry its own details, so that the place that knows the server response is the place that records it.
42. As a developer, I want a caller to keep its own plain message while the error's message moves into the details, so that fixed messages keep their words.
43. As a developer, I want a dev-router entry that raises a sample error toast, so that I can check the toast and the window in one step.

## Implementation Decisions

**One entry point for error toasts.** Every toast raised from a caught error goes through the existing `toastError`. It takes the caught error and a fallback message. It also takes an optional headline. With a headline, the headline becomes the toast text and the error's own message moves into the details. The 60 fixed-message sites use the headline, so their words don't change.

**Which toasts use it.** A toast raised in a `catch`, or from a failed result that carries an error, goes through `toastError`. Form validation, refusals and other toasts with no error behind them stay plain `toast.error`, with no link. Each of the ~150 sites is classified during the sweep; the sweep doesn't change toast wording. Three classification rulings:

- A toast that summarizes several caught errors, with nothing else showing them, wraps them in one `AggregateError` and goes through `toastError`; the built details list each failure by name with its own details or message. A summary toast whose failures already show inline, one per row, stays plain: the rows are the error, the toast is a count.
- A toast that fires after another toast already carried View Details for the same error stays plain, so one failure never shows two links. The in-game turn-failure toast converts only when the request did not speak for itself: a silent pass or a pipeline error. The empty-narration toast stays plain; nothing was thrown.
- A `FileReader` failure counts as a caught error; its `error` field is the error.
- The rejected-override notice is the only toast for a structured endpoint rejection, so it converts: both of its lines stay as the toast body, and View Details opens the stream error's details. The link toast may take a two-line body for this.
- The clipboard failure toast stays plain. It backs Error Details' own Copy button, so a link there would reopen the window the player just failed to copy from.
- A result-returning service that swallows several errors and reports only their ids may add an `errors` array to its result, each entry an `Error` named by the id with the caught error as its cause. This is the one sanctioned additive change to a result shape: without it the aggregate rule has nothing to wrap. Default-world loading is the first case; both its toasts, in Settings and in the main menu, wrap that array.

**Every error gets details.** `toastError` always offers View Details. An error that carries a string `details` field supplies its own details; `toastError` checks for the field, not for a class, so any error class can carry details without changing its type. `DetailedError` stays as the plain class for throw sites that have no class of their own. Any other error gets built details: its name, its message, its cause chain and the top 10 stack frames. A failed service result that holds only a string is wrapped in an error, so it still gets the link.

**The diagnostics block.** Every Error Details view ends with the same version, platform and system block that the bug report collects. It reuses the existing diagnostics collector, so the two never disagree.

**Throw sites carry what they know.** The code that holds the server's response builds the details and puts them on the thrown error. The toast code never reads a response.

- `AiStreamError` keeps its class, its `kind`, its `status` and its `serverError`, because the rejected-override code checks all three. It gains a `details` field: the status, the server's message, param, type and code, and the raw body. The stream reads the body once as text, keeps the raw string and parses the structured fields from it. The in-game "Failed to process AI request" toast passes the error through, so the server's reason reaches Error Details.
- The InvokeAI, Automatic1111 and OpenAI image providers put the status and the body on their thrown errors, as ComfyUI does now. `InvokeHttpError` keeps its class and gains `details`.
- The community service calls that throw on a failed response add the route, the status and the body. The route is the response URL; the HTTP method is not recorded, because a Response does not carry it and the toast's own message already names the action. Staff match the path, the status and the time against server logs. Community means the calls whose failures reach a toast: world storage, the staff API, feedback, audit, events, messages, users, the age gate and catalog downloads. Sign-in, register and the account routes are out: their errors show inline in forms, not in toasts, and they do not change.
- A throw-site ticket proves its slice end to end by converting the few toasts that show its errors; the sweep tickets skip toasts an earlier ticket already converted. Ticket 04 converts the delete, quarantine and release toasts in the Community Creations browser; ticket 08 leaves them alone.

**Redaction.** Details never include request headers. A key, token or password in a URL's query string is replaced with a mask before the URL enters the details. Response bodies are shown as the server sent them.

**Error Details window.** The existing dialog host stays mounted beside the toast container, so it outlives the toast. Its buttons become **Copy** and **Report Bug**. Copy puts the message, the details and the diagnostics block on the clipboard through the shared copy helper.

**Report Bug.** Report Bug opens the existing bug report with a title and a description filled in. The title is the toast's message. The description is the details, without the diagnostics block, because the bug report attaches its own. The bug report takes new optional initial-title and initial-body props. Details longer than the bug report's body limit are cut, with a line that says Copy has the full text.

**Report Bug hands off, it does not stack.** Pressing Report Bug closes Error Details and opens the filled-in report. The two dialogs never stack. The details live on in the report's description, so the text is not lost when the toast has already gone. A title longer than the report's title limit is cut the same way the description is. Until sign-in-first lands, a signed-out player does not see Report Bug, the same way play hides its own button today; the sign-in-first ticket shows it and adds the sign-in path.

**Where the bug report mounts.** Today the bug report is mounted only in play and in the main menu's feedback hub; the World Editor has none. This effort mounts one bug report beside the Error Details host, next to the toast container, so all three views share it. It opens through the same store pattern Error Details uses. The existing mounts in play and the feedback hub stay for their own buttons.

**Report Bug and the community flag.** Bug reports are a community feature. When the community flag is off, Error Details shows Copy only, the same way play hides its own Report Bug button today.

**The filled report wins over a draft.** The bug report keeps one unsent draft. When Error Details opens the report, the filled-in title and description replace that draft, and the old draft is dropped. The filled-in report then becomes the saved draft until it is sent or discarded. Merging the two is not attempted: the body limit makes a merge lossy, and the player chose to report this error.

**Sign-in first.** Today only the main menu can raise the sign-in dialog. This effort adds a way to raise sign-in from anywhere, in the same store pattern Error Details uses. Sign-in in the main menu runs the age gate's `requireAuthentication` check first; sign-in raised from Error Details runs the same check, so Report Bug never bypasses a policy step. Every sign-in raise goes through that one checked path, including the guest-like button in Community Creations and the auth dev route; the browser already sits behind attestation, so no player sees a new step, and the dev route showing the gate to an unattested tester is dev-only and correct. When a signed-out player presses Report Bug, the check runs and sign-in opens. When sign-in succeeds, the filled-in bug report opens. When sign-in or the check is canceled, Error Details stays open.

**Existing links.** "Fix connection →" and "View Details →" both use the shared link toast. A toast has one link. The connection-guide toast keeps its link, and its error goes to the connection guide, not to Error Details.

**Dev route.** `#dev?modal=errorDetails` already raises a sample ComfyUI toast. It stays, and the sweep adds no new routes.

**Export shape.** No world or save file changes.

## Testing Decisions

A good test raises a real error through a public call and checks what the player sees: the toast text, the link, the window's text and the clipboard. It never checks which internal function built the details.

Two seams, both already in use:

1. **The toast and the window.** Render the real themed toast container, call `toastError`, click **View Details →**, and read the window. The prior art is the existing link-toast test. It covers the headline form, built details for plain errors, the diagnostics block, Copy, Report Bug with and without sign-in, the filled-in report and the draft, the body limit, and plain toasts staying linkless.
2. **The throw sites.** Call each public function with a stubbed fetch that fails, and check the thrown error's message and details. The prior art is the ComfyUI provider test. It covers the AI stream, the three other image providers and the community services. The stream test also checks that the rejected-override detection still sees an `AiStreamError` with its `kind`. Redaction is tested here: a URL with a key in its query string must come out masked.

Each new guard is mutation-tested: remove the headline, drop the diagnostics block, skip redaction, drop the body, hide Report Bug with the flag on, keep the old draft. Each change must fail its test.

The sweep's classification has no unit test. The changed call sites are covered by the gates and the two seams above.

## Out of Scope

- Changing the words of any toast.
- Services that return a result object and never throw don't change shape. Their failed results only get wrapped at the toast.
- Automatic error reporting or telemetry. Nothing leaves the device unless the player copies it or files a bug report.
- Uploading source maps or decoding production stacks.
- The content Report flow for listings, comments and profiles. That is a different feature, and this effort doesn't touch it.
- Success, warning and info toasts.

## Further Notes

- The ComfyUI rejection is the first `DetailedError`. Its tests and its dev route are the reference.
- The glossary's **Report** means a content report to staff. This spec uses "bug report" for the feedback kind, to keep the terms apart.
- The sign-in dialog is main-menu state today. Raising it in play is the riskiest part of this effort; check that sign-in in play doesn't reset the game view.
- `toastError` checks for a `details` field rather than `instanceof DetailedError` because `AiStreamError` and `InvokeHttpError` already exist and other code checks their classes.
- Bug reports are filed against an account, which is why signed-out players sign in first.
