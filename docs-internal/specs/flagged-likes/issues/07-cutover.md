# 07: Cutover

Status: done
Blocked by: 01, 03, 04, 05, 06, 08
Recommended model: N/A — operator steps on the live server and release
Reasoning effort: N/A
Spec: ../spec.md (Ordering constraint)

## What to build

Switch collection on in the order the privacy text requires.

## Acceptance criteria

- [x] Deploy the server with the collection setting off. (Read on 2026-11-05: the deployed commit holds ticket 04, and no like had a kind.)
- [x] Run `npm run publish-policy` on the server (dry run first, then write); deploy alone does not change the live privacy row. Decide whether users re-accept. (The live policy route serves the new text. The re-accept choice is the operator's and was not read.)
- [x] Confirm the server privacy policy and the client privacy page both carry the new lines and the IPLocate.io credit. (Both read live on 2026-11-05.)
- [x] Confirm the server's data folder (`/srv/formamorph/data/network-lists/`) holds five `.txt` files and the log shows no `Network list … was refused` line. (Read on 2026-11-05.)
- [x] Release the client. (Operator's report.)
- [x] Switch the `network_kind` setting on. (Set over SSH on 2026-11-05 at 11:59 UTC at the operator's request, because the Server Settings tab has no row for it; ticket 09 adds one.)

For you: after a day, open the Flagged Likes filter and check the markers look plausible before tuning the thresholds.
