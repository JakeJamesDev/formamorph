# Spec: Bundled upload block (client)

Status: ready-for-agent

Server side: the FormamorphServer repo, `docs-internal/specs/bundled-upload-block/spec.md`.

## Problem Statement

Players keep publishing bundled worlds and the default Avatar to Community Creations without changing them. Every player already has these, so the listings add nothing to the catalog. They crowd out real work, and staff remove them by hand. Nothing stops the upload: the publish dialog accepts a bundled world exactly as it accepts a world the player wrote.

## Solution

The app refuses to publish an unmodified bundled world or the default Avatar. The refusal comes before the publish dialog opens, and it tells the player what to change:

- World: "This is a bundled world. Edit it to make it your own, then publish."
- Avatar: "This is the default avatar. Upload your own VRM."

The server makes the same check, so old clients and duplicated copies are refused too. After any real edit to a bundled world's text, the world publishes as normal.

## Definitions

- **Bundled world**: a world the app ships in its default world set and seeds into every library.
- **Default Avatar**: the VRM the build ships as the seeded default model. The SFW build and the release build ship different files. Both count.
- **Bundled fingerprint**: a hash of a world's authored text, stable across migrations. The fingerprint list holds the fingerprint of every revision of every bundled world, plus the byte hashes of both default Avatar files.

## User Stories

1. As a player, I want the app to stop me before I publish a bundled world I did not change, so that I do not wait for an upload the server refuses.
2. As a player, I want the refusal to tell me to edit the world first, so that I know how to publish it.
3. As a player who edited a bundled world, I want to publish my version, so that my changes reach the community.
4. As a player who only renamed a bundled world, I want the refusal to still apply, so that the rule is clear: a new name is not a new world.
5. As a player, I want the app to stop me before I publish the default Avatar, so that I do not upload a model every player already has.
6. As a player who imported the default Avatar file again under a new name, I want the same refusal, so that the check follows the file and not the library entry.
7. As a player, I want every world I wrote to publish exactly as today, so that the check never blocks my own work.
8. As a player on an old client, I want the server to refuse a bundled world with the same message, so that I get a reason and not a bare error.
9. As a player who duplicated a bundled world, I want the server to refuse the copy, so that a duplicate is not a way around the rule.
10. As a player who downloaded a bundled world from an old version, I want it refused too, so that the rule does not depend on which version I play.
11. As a staff member, I want no new unmodified bundled listings, so that I stop removing them by hand.
12. As a developer, I want a failing test when I edit a bundled world and forget to update the fingerprint list, so that the list never goes stale.
13. As a developer, I want one command that regenerates the fingerprint list from git history, so that the update is mechanical.
14. As a developer, I want the release process to copy the list to the server, so that the server learns each new bundled revision.
15. As a developer, I want the client and the server to compute the same fingerprint for the same world, so that a world the client accepts is not refused by the server for a hashing reason.
16. As a developer, I want live listings left alone, so that the change carries no data migration.

## Implementation Decisions

- **Scope**: world listings and Avatar listings only. Entities and dictionaries copied from bundled worlds are not checked.
- **Response**: hard refusal on both the client and the server. No warning mode and no review flag.
- **Client world check**: a new publish-attempt function mirrors the existing Avatar publish attempt. It refuses when the world's id is a bundled world id and the world has no local edits (the dirty flag is not set). Otherwise it returns the payload. The main menu's world publish button calls it and shows the refusal as a toast, exactly as the Avatar path does.
- **Client Avatar check**: the existing Avatar publish attempt gains one more refusal. It refuses when the model's stored byte hash equals the seeded default model's byte hash. This check runs before the license gate.
- **The client does not fingerprint worlds.** A duplicated or re-imported bundled world gets a new id and passes the client. The server refuses it.
- **Fingerprint function**: collect every string value of 40 or more characters from the world content, at any depth, except values under a `code` key. Collapse each whitespace run to one space and trim. Remove duplicates, sort, join with a newline, and take a lowercase hex SHA-256. Stat code is excluded because world migration rewrites it. A validation run over the full git history showed zero mismatches between a raw bundled file and its migrated publish payload once `code` was skipped.
- **Generator script**: walks the git history of every bundled world file, follows renames, fingerprints each revision, and writes the list. The list also holds the byte SHA-256 of the SFW and release default Avatar files. The output is a small generated JSON file, committed in the client repo.
- **Delivery**: the release skill gains a step: run the generator, then copy the file into the server repo. A late copy is harmless, because the client check already covers the current bundle.
- **Export shape**: no change. The world and save export shapes are untouched.

## Testing Decisions

A good test drives the publish attempt with a real library record and asserts on the verdict and the message. It never asserts on how the fingerprint is computed inside.

- **Publish attempt (world)**: a bundled id with no edits is refused with the world message. The same world with the dirty flag set is allowed. A world with a non-bundled id is allowed. Prior art: the Avatar publish attempt tests.
- **Publish attempt (Avatar)**: the seeded default model is refused with the Avatar message. The same bytes stored under a new id are refused. Another model reaches the license gate as today.
- **Drift test**: for every bundled world file in the tree, its current fingerprint is in the list. The test fails after a text edit to a bundled world until the generator runs. Prior art: the bundled Avatar license test, which checks every shipped file.
- **Shared test vector**: a fixed small world and its expected fingerprint. The same vector sits in the server tests, so both implementations are pinned to one answer.
- Prove each guard bites: restore the unguarded behavior and watch the test fail, per the test bar.

## Out of Scope

- Entities and dictionaries copied from bundled worlds.
- Similarity matching. A one-line edit passes.
- Hiding or reviewing listings that are already live.
- Any change to the publish dialog itself.

## Further Notes

- The only version-sensitive part is the fingerprint list, and it only grows. Old fingerprints stay, so a world from any earlier version still matches.
- Unreleased commits add fingerprints too. That does no harm.
- The validation run covered migrations with the current client only. An older client's migration could rewrite other text. If a refusal slips through, compare that client's publish payload against the list.
