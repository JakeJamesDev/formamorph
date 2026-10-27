# 05: File From the Website

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: reuses the app's filing form with a narrower type list; the similar-threads list already exists.

**What to build:** a signed-in visitor presses New on the website and files a suggestion or a question. The form offers only those two types and collects no diagnostics. While the visitor types a question title, the similar-threads list shows matching threads. A short line in the form says bug reports are filed in the app, with a link that opens it. After filing, the visitor lands on the new thread's `/feedback/<id>` address.

- [x] The type picker offers Suggestion and Question only. (`FeedbackPage.filing.test.tsx`, tab names)
- [x] Filing sends no diagnostics field. (same file, POST body has no `diagnostics`)
- [x] Typing a question title shows the similar-threads list, and opening one goes to its `/feedback/<id>`. (same file; the draft stays stored)
- [x] The form shows the bug-report line with a working link to the app. (same file, link `href="/play/"`)
- [x] A successful filing navigates to the new thread; a refused filing (rate limit) shows the server's message and keeps the form. (same file, 429 case)
- [ ] The new copy passes the copy-sweep rules (STE, AP title case labels). Read by hand, no `copy-sweep` run.

## Landed

**Not verified**
- Copy-sweep: the one new line ("To report a bug, open the app. Bug reports include details about your device.") was read by hand against STE. No sweep skill run. No new labels.
- No Playwright e2e for filing; the jsdom page tests cover it.

**For you**
- Open `/feedback` signed in, press **Suggest Something**, and read the form: the bug line, the missing "in your profile" wording, the inline red error on a refused filing.
- The inline error line shows in the app dialog too, next to its toast.
