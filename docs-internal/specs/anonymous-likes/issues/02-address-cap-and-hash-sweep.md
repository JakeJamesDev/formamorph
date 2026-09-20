# 02: Address cap and hash sweep

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Server)

Model rationale: one guard and one sweep step, both with clear patterns to copy.

## What to build

One address can give one listing at most three Anonymous Likes. The hourly sweep blanks the address hash on Anonymous Likes older than the Signal retention period and keeps the like.

## Acceptance criteria

- [ ] The fourth Install on one address hash is refused for that listing with its own code. The same Installs can still like other listings.
- [ ] An Install that already holds the like can clear it and set it again at the cap.
- [ ] The cap counts only rows whose hash is not blank.
- [ ] The cap is one named constant.
- [ ] The sweep step takes the clock as an argument, blanks only rows past retention, and reports a count.
- [ ] The step fails on its own and never stops the Signal purge, in the style of the multi-step event sweep.
- [ ] A blanked row still counts in the public number.
- [ ] Tests: four Installs on one address; the cap after a sweep with a passed-in clock; the sweep leaving young rows alone.
