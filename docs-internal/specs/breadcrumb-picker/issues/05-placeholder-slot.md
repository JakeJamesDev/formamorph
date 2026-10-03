# 05: Placeholder Slot Reach and Folders

Status: ready-for-human
Base: 2b661e8f
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Parent: [Breadcrumb Picker spec](../spec.md)

## What to build

The placeholder slot lists only names that `placeholders["X"]` reaches, with a breadcrumb from Placeholder folders (Q4, Q5).

- Read the top-level keys of the shared placeholder path map, the resolver the completions and the sandbox use. Owned placeholders (reached through their owner) and child placeholders (reached through their parent path) drop out of the list.
- The breadcrumb comes from the placeholder's Placeholders-tab folder. An ungrouped placeholder has no breadcrumb.

## Acceptance criteria

- [ ] The Code Templates dialog test uses a world with an owned placeholder, a child placeholder and a foldered one. Only top-level keys are listed. The foldered one shows its folder path.
- [ ] The guard bites: list the whole world placeholder list again and the test fails.
- [ ] The built-in "placeholder follows stat" template still inserts working code for a top-level placeholder.
- [ ] The four gates are green.

## Notes from ticket 03

- Every name slot already opens the Breadcrumb Picker. This ticket changes the placeholder row source only.
- Follow the row shape the world-trait source uses (`worldTraitPlaces` returns `CodeTraitPlace { id, name, path }`).
