# 02: Address cap and hash sweep

Status: ready-for-human
Status note: Built in FormamorphServer as 3ede60f + 916571a. All 1618 server tests pass (22.75s). The cap refuses with 403 and `anonymous_likes_address_cap`; ticket 03 branches on the code, not the status.
Base: d1785716
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Server)

Model rationale: one guard and one sweep step, both with clear patterns to copy.

## What to build

One address can give one listing at most three Anonymous Likes. The hourly sweep blanks the address hash on Anonymous Likes older than the Signal retention period and keeps the like.

## Acceptance criteria

- [x] The fourth Install on one address hash is refused for that listing with its own code. The same Installs can still like other listings.
- [x] An Install that already holds the like can clear it and set it again at the cap.
- [x] The cap counts only rows whose hash is not blank.
- [x] The cap is one named constant, and its refusal code joins the shared codes export that ticket 01 made in the anonymous-likes config.
- [x] The table already carries the address hash and browser family from ticket 01; this ticket adds no column.
- [x] The server repo's `CONTEXT.md` gains **Install** and **Anonymous Like**, and its **Like** entry says the public count is the sum.
- [x] The sweep step takes the clock as an argument, blanks only rows past retention, and reports a count.
- [x] The step fails on its own and never stops the Signal purge, in the style of the multi-step event sweep.
- [x] A blanked row still counts in the public number.
- [x] Tests: four Installs on one address; the cap after a sweep with a passed-in clock; the sweep leaving young rows alone.
