# 10: Lookup Mode on by default

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

## What to build

Lookup Mode (`read_guide`) starts on, and the row says when it runs.

- The default flips to on. The capability gate is unchanged: the cloud endpoint refuses functions, so its requests stay byte-equal.
- The row's help copy, in the help voice: it runs on endpoints that accept functions, reads guide sections during the answer, and roughly quadruples input tokens per question.

Spec: Q6; Implementation → Help settings.

Recommended model rationale: a default flip, one copy line and two tests.

## Acceptance criteria

- [ ] Settings test: the default is on.
- [ ] Session test: the function is offered on a function-taking endpoint and the cloud body is byte-equal to today's.
- [ ] The copy passes the copy sweep.
- [ ] The four gates are green.
