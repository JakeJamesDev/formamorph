# 07: Cutover

Status: ready-for-human
Blocked by: 01, 03, 04, 05, 06
Recommended model: N/A — operator steps on the live server and release
Reasoning effort: N/A
Spec: ../spec.md (Ordering constraint)

## What to build

Switch collection on in the order the privacy text requires.

## Acceptance criteria

- [ ] Deploy the server with the collection setting off.
- [ ] Confirm the server privacy policy and the client privacy page both carry the new lines and the IPLocate.io credit.
- [ ] Confirm the server downloaded the three lists.
- [ ] Release the client.
- [ ] Switch the collection setting on in the Server Settings tab.

For you: after a day, open the Flagged Likes filter and check the markers look plausible before tuning the thresholds.
