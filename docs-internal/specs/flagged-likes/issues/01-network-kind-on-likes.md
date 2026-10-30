# 01: Network Kind on likes

Status: ready-for-human
Base: f63e6bd
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Server)

Model rationale: a new module, a refresh job with failure handling, two schema changes, and a retention change that the privacy text promises. A wrong sweep is a privacy bug.

## What to build

When the collection setting is on, every like the server stores (account and anonymous) records its **Network Kind**: `tor`, `vpn`, `hosting`, or none. The kind comes from a Network Classifier that matches the request address against local copies of the X4BNet VPN and data-center lists (IPv4 and IPv6) and the Tor bulk exit list, with Tor before VPN before hosting. The server downloads the lists daily, keeps the last good copy on disk and in memory when a download fails or is invalid, loads the disk copy on startup, and classifies as none until a list is loaded. Matching uses Node's built-in `net.BlockList`.

The 90-day retention sweep now blanks `address_hash`, `browser_family` and `network_kind` on Anonymous Likes, and `network_kind` on account likes. The like stays. A claimed Anonymous Like keeps its kind.

The server privacy policy states the new collection, its 90-day limit, that the lists are local, the IPLocate.io credit, and that the browser family beside an Anonymous Like is blanked at 90 days.

## Acceptance criteria

- [x] A new boolean setting switches collection, default off, listed in the settings map with a one-line comment like its neighbors. `network_kind` in `src/config/settings.js`, staff-writable like `anonymous_likes`.
- [x] With the setting on, a like from a fixture Tor, VPN or hosting address stores that kind; an address on two lists stores the higher-precedence kind; an unlisted address stores none. `networkKind.test.js` › "storing the kind beside a like", account and anonymous, IPv4 and IPv6.
- [x] With the setting off, no kind is stored. "stores none while collection is off".
- [x] Before any list is loaded, a like succeeds and stores none. `networkKindFresh.test.js`, its own worker so no list was ever loaded.
- [x] A failed or invalid download keeps the previous lists in effect, proven with a stubbed download. "keeps the previous copy on disk and in memory after …", both cases, with the refusal log asserted.
- [x] A claimed Anonymous Like keeps its kind on the account like. "carries the kind onto the account like".
- [x] The sweep blanks hash, browser family and kind at 90 days and keeps the like; a younger like keeps all three. "letting go of the kind after ninety days", plus a catch-up case for rows the old sweep blanked hash-only.
- [x] The classifier never reads a forwarded header of its own; it classifies the same address the hash uses. "the address the kind is read from": CF-Connecting-IP and X-Real-IP ignored, client-prepended XFF hop ignored, stored hash equals `addressHash` of the classified address.
- [x] The server privacy policy carries the new collection text, the retention lines and the IPLocate.io credit. `bootSchema.test.js` pins the new section, both retention lines and the credit.
- [x] Each guard is proven to bite by reinstating its bug once. 17 mutations (precedence, switch, forwarded header, bad line, empty list, disk-before-parse, claim, each sweep column, catch-up, account sweep, catch isolation, young rows, repeat press, unloaded lists, policy credit and retention line): all 17 went red, rerun after the review fold-in.

## Landed

**Not verified:**

- None. Every criterion above is ticked.

**For you:**

- The live privacy row does not change on deploy: boot seeds only an empty database. Run `npm run publish-policy` on the server (dry run first, then write) before switching `network_kind` on. Whether users re-accept is your call.
- After deploy, check that `data/network-lists/` on the server holds five `.txt` files, and that the log shows no `Network list … was refused` line.
- The sweep now blanks the browser family on Anonymous Likes older than 90 days, including rows swept before this landed. The likes audit then shows no family on those rows; the client already hides an empty one.
