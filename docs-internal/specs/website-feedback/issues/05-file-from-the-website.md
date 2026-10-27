# 05: File From the Website

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: reuses the app's filing form with a narrower type list; the similar-threads list already exists.

**What to build:** a signed-in visitor presses New on the website and files a suggestion or a question. The form offers only those two types and collects no diagnostics. While the visitor types a question title, the similar-threads list shows matching threads. A short line in the form says bug reports are filed in the app, with a link that opens it. After filing, the visitor lands on the new thread's `/feedback/<id>` address.

- [ ] The type picker offers Suggestion and Question only.
- [ ] Filing sends no diagnostics field.
- [ ] Typing a question title shows the similar-threads list, and opening one goes to its `/feedback/<id>`.
- [ ] The form shows the bug-report line with a working link to the app.
- [ ] A successful filing navigates to the new thread; a refused filing (rate limit) shows the server's message and keeps the form.
- [ ] The new copy passes the copy-sweep rules (STE, AP title case labels).
