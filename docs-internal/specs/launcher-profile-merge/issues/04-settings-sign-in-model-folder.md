# 04: Settings, Sign-In and Model-Folder Choice

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: fill-missing rules across localStorage and one main-process file, registered against ticket 02's interface.

## What to build

The merge also brings over settings, sign-in and the model-folder choice. All three copy only what the folder lacks (Q5, Q9).

- **Settings and sign-in** are localStorage keys. A key the folder already has stays. A key only AppData has is copied, sign-in included. Caches and device-local UI state follow Q10 and stay behind.
- **The model-folder choice** lives in a main-process file in the profile. Each field the folder lacks takes the AppData value. Ticket 05 reads the result to find where models go.
- Settings and sign-in run first in the merge, as the smallest category (Q14).

## Acceptance criteria

- [ ] Engine tests: a folder key stays, a missing key is copied, and a signed-in AppData copy signs in a signed-out folder.
- [ ] Tests: a folder model-folder choice stays, and a missing one takes the AppData value.
- [ ] Settings applied by the merge take effect without a restart, or the result screen asks for one.
- [ ] A test fails when the fill-missing guard is removed.
- [ ] A changelog fragment covers settings and sign-in.
