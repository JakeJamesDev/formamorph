# Changelog fragments

A ticket branch never edits `docs/Changelog.md`. It writes its entry here, as one file per ticket, and the prepare step folds the file into the changelog on the rebase and deletes it. Two tickets that touch the same entry land as two folds, never as a duplicated line.

## Format

```
Minor / Added / 👤 / Prompts
- **The bold lead, a standalone sentence.** The rest of the entry.
  - A continuation line, when the entry has one.
```

| Line | Holds |
|---|---|
| 1 | The bucket: `Scope / Kind / Audience [/ Topic]` |
| 2+ | One entry, as it will appear in the changelog |

- **Scope** is `Major` or `Minor`.
- **Kind** is `Added`, `Removed` or `Fixed`.
- **Audience** is `👤`, `🛠️` or `⚙️` (or `user`, `dev`, `backend`).
- **Topic** is optional: the group header the entry sits under, without its colon. A missing group is created before the loose entries.

## Folding

A fragment whose bold lead already exists under 🚧 In Progress folds into that line. Write the exact lead and only your new sentences. Prepare appends the sentences that are not there yet and ignores the bucket. 🔁 Re-running prepare after the main branch moves replays the fold onto the new changelog, once.

## Checks

- A direct edit of `docs/Changelog.md` on a ticket branch is refused, by the write hook and again by prepare.
- A malformed fragment stops prepare and names the file.
- `README.md` is the one file here that prepare ignores.
