# 01: Network Kind on likes

Status: ready-for-agent
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

- [ ] A new boolean setting switches collection, default off, listed in the settings map with a one-line comment like its neighbors.
- [ ] With the setting on, a like from a fixture Tor, VPN or hosting address stores that kind; an address on two lists stores the higher-precedence kind; an unlisted address stores none.
- [ ] With the setting off, no kind is stored.
- [ ] Before any list is loaded, a like succeeds and stores none.
- [ ] A failed or invalid download keeps the previous lists in effect, proven with a stubbed download.
- [ ] A claimed Anonymous Like keeps its kind on the account like.
- [ ] The sweep blanks hash, browser family and kind at 90 days and keeps the like; a younger like keeps all three.
- [ ] The classifier never reads a forwarded header of its own; it classifies the same address the hash uses.
- [ ] The server privacy policy carries the new collection text, the retention lines and the IPLocate.io credit.
- [ ] Each guard is proven to bite by reinstating its bug once.
