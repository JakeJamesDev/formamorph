# 05: Thread Links

Status: ready-for-agent
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q2, Q11, Q20, Q22; Link grammar; Shared rendering)

## What to build

In the app and on the website, a feedback thread shows its `#N` in the header and in list rows. `#N` and pasted thread URLs in bodies and comments render in the look ticket 01 settled, and open that thread. An unavailable thread renders the unavailable form.

This ticket owns the client link layer on the shared markdown renderer, the client parser, the client copy of the grammar case table, and the unavailable form. Tickets 06 and 07 add their link kinds to this layer.

## Acceptance criteria

- [ ] The client parser passes its copy of the case table, which matches ticket 03's table.
- [ ] The thread view, rendered with a mocked feedback service in app mode and site mode, shows `#N` links, thread URL links and the unavailable form.
- [ ] Code spans and code blocks show `#N` as plain text.
- [ ] Clicking a thread link opens that thread in the app and the matching route on the site.
- [ ] The site bundle boundary test stays green.
- [ ] The wiki's feedback section explains `#N` and thread links.
- [ ] Frames of a thread with each form, light and dark: `.scratch/frames/thread-links-<theme>.png`.
