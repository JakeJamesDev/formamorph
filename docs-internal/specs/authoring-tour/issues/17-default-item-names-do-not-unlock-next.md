# 17: Default Item Names Do Not Unlock Next

Status: ready-for-agent
Blocked by: 13, 14
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Authoring Tour](../spec.md)

**What to build:** Ticket 14's World Name rule now covers every item the tour adds. The editor's **Add** names a new item "New Location", "New Entity", "New Stat" or "New Trait". That untouched default name no longer counts as a value, so each Name step opens with **Next** disabled. **Next** unlocks once the author changes the name or uses **Use Example**. The reason is the same as for the world: the author never chose that name.

**Rationale for the model:** extends one predicate from ticket 14 to four item kinds, plus one e2e assertion. Sonnet at medium effort.

## Acceptance criteria

- [ ] Each default name lives once, beside the constructor that uses it, as the world's name already does. The editor's **Add** and the step predicates read the same constant.
- [ ] The location, entity, stat and trait Name steps open with **Next** disabled on a freshly added item.
- [ ] Typing any other name, or using **Use Example**, enables **Next**. Clearing the name disables it again.
- [ ] A step that also needs another field (such as the trait's Player-Facing Description) still needs both. A default name never satisfies the name half.
- [ ] If a dictionary entry gets a default name on add, the Dictionary Name step follows the same rule. If it does not, record that in Comments.
- [ ] Ticket 13's e2e walk asserts **Next** disabled on every field step before **Use Example**. Remove its exception for the three default-named steps.
- [ ] Tests run through the World Editor Bench harness, one per item kind. Prove the guard by letting the default name count and watching the tests fail.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Run the e2e walk once with `E2E_PORT=5221`. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- The editor's own default names do not change. Only what the tour counts as a value changes.
- Build on `feature/authoring-tour` in the worktree. The step registry is shared with other tickets, so sequence edits with any parallel session.
