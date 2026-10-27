# 03: Server Re-flag Pass

Status: ready-for-agent
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q3, Q6); server spec: Re-flag pass

Repo: FormamorphServer

## What to build

A new schema step runs once and recomputes the rename flag under the new rule. A flagged account whose name passes the new rule and has no twin under the folded key loses its flag. In a twin group, the account whose name passed the old rule keeps the name and the others stay or become flagged. When no member passed the old rule, the oldest (`created_at`, then `id`) keeps it. The step never flags an account the old pass left unflagged, and never flags the placeholder.

At deploy on live data, a player flagged only for an inner space keeps the name and never sees the rename dialog.

## Acceptance criteria

- [ ] A fixture database covers: a spaced name with no twin (cleared), a spaced name twinned with an unflagged underscore name (stays flagged), two flagged twins (oldest cleared, the other stays), a name still outside the rule (stays flagged) and the placeholder (never flagged).
- [ ] No account unflagged before the step is flagged after it.
- [ ] The step runs once; a second schema run does not repeat it.
- [ ] A cleared account appears in mentions and the username search.
