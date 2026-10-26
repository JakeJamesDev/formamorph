# 01: Variable Menu Top-Level Order

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one sort step in one builder, with three test pins and a reference page that follow it.

## What to build

The Variable menu's top level lists every group first, then the fields such as `notes`, then the verbs such as `discover` (Q1). The timing groups **Narration**, **Player** and **Switched Trait** sit right after **This Stat** or **This Trait** and **Owner**, before the world's groups (Q2). The groups-first step is the top level's own: inside a group the fields-then-verbs rule stays as it is, so a stat's `previous` and `delta` keep their places. The sort runs after the one-child-to-leaf step, since **Discover** is a one-call group until then. One builder serves Scripts and user Tools, so the Tool menu changes with it. The Design System's Variable menu reference and the Scripts guide show the new order where they show the top level. The changelog fragment carries the menu entry.

Spec: Q1, Q2, stories 1–3.

## Acceptance criteria

- [x] A stat box with no timing global lists, in order: **This Stat**, **Stats**, **Traits**, **Entities**, **Persona**, **Placeholders**, **Dictionaries**, **Clock**, **Turn**, **Locations**, **Location**, **Memories**, `notes`, `discover` (test "lists the sandbox’s globals in the order an author meets them")
- [x] A During AI Output stat box lists **Narration** right after **This Stat**; an After the AI box with an owner lists **Player** right after **Owner**; a When a Trait Switches trait box lists **Player** then **Switched Trait** right after **This Trait** (tests "puts the timing groups right after…" and "lists Narration in During AI Output only…")
- [x] A world script box (no `self`) puts the timing groups first; a user Tool box keeps `notes` after every group and lists no verb (the same timing test; `toolScriptMenu.test.ts` passes unchanged)
- [x] Inside a group nothing moves: a stat's fields keep their surface order with `previous` and `delta` in place, and a location's `present` and `exits` keep theirs (the existing in-group tests pass unchanged)
- [x] Reinstating the fixed top-level list turns the order tests red (mutated the sort to a no-op: two order tests failed; restored and grepped)
- [x] The Variable menu reference page and the Scripts guide show the new top-level order where they list it; the changelog fragment names the menu change (the reference page renders the live tree, so it needed no edit; `ScriptsGuide.md` lines 61 and 246 updated)

## Landed

**Not verified**

- The menu was not checked in a browser. Tests read the built tree and the arrow-key walk in `CodeArea.test.tsx`.

**For you**

- Open a stat's **Variable** menu: groups, then `notes`, then `discover`. Check a During AI Output box for **Narration** right after **This Stat**.

## Blocked by

- None (can start immediately)
