# 07: Cutover

Status: ready-for-human
Blocked by: 01, 03, 04, 05, 06, 08
Recommended model: N/A — operator steps on the live server and release
Reasoning effort: N/A
Spec: ../spec.md (Ordering constraint)

## What to build

Switch collection on in the order the privacy text requires.

## Acceptance criteria

- [ ] Deploy the server with the collection setting off.
- [ ] Run `npm run publish-policy` on the server (dry run first, then write); deploy alone does not change the live privacy row. Decide whether users re-accept.
- [ ] Confirm the server privacy policy and the client privacy page both carry the new lines and the IPLocate.io credit.
- [ ] Confirm `data/network-lists/` on the server holds five `.txt` files and the log shows no `Network list … was refused` line.
- [ ] Release the client.
- [ ] Switch the `network_kind` setting on in the Server Settings tab.

For you: after a day, open the Flagged Likes filter and check the markers look plausible before tuning the thresholds.
