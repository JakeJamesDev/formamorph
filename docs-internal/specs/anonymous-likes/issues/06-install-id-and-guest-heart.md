# 06: Install id and the guest heart

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Repo: formamorph
Spec: ../spec.md (User Stories › Liking as a guest; Implementation Decisions › Client)

Model rationale: touches the storage service, the catalog cache tag, the capabilities type, and the like coordinator. A wrong cache tag shows the wrong hearts.

## What to build

A guest in the app presses the heart and it fills, on the tile and in the detail view, for every kind of listing. The website still sends guests to sign-in.

## Acceptance criteria

- [ ] One module owns the Install id: `crypto.randomUUID()`, made on first need, stored under the existing key prefix, safe when storage throws.
- [ ] The server accepts only a strict UUID in the Install header and answers `install_header_invalid` to anything else. Send the `crypto.randomUUID()` value unchanged. A stored id that is not a UUID is replaced.
- [ ] Read the header name and the refusal codes from the server repo's anonymous-likes config (commit `48dd31d`). The codes so far: `anonymous_likes_off`, `listing_not_visible`, `install_header_invalid`, `liked_invalid`. Tickets 02 and 03 add the cap and linked-account codes.
- [ ] Catalog, detail, and like requests carry the Install header only when no session exists.
- [ ] The reader part of the catalog cache tag includes the Install id, so guest and account caches never mix.
- [ ] The browser capabilities gain a guest-likes field: true for the app, false for the website.
- [ ] The client learns the server setting from the `anonymousLikes` boolean on the catalog and detail responses. A missing flag means off. It is kept with the catalog cache.
- [ ] The heart toggles for a guest when the capability and the server setting are both on. Otherwise the existing guest handler runs. A "setting off" refusal on a press also falls back to the guest handler.
- [ ] The like coordinator picks the account route or the anonymous route by session. The update is optimistic, and the count comes from the response.
- [ ] The cap refusal shows a short toast that offers sign-in. Other refusals restore the heart silently. A network failure toasts.
- [ ] An own listing still shows a static count for a guest whose linked account wrote it (the server refusal restores the heart).
- [ ] `CONTEXT.md` gains **Install**, **Anonymous Like**, and **Claim**, and the **Like** entry says the public count is the sum.
- [ ] Copy follows the player-facing voice. The word is "like".
- [ ] Changelog In-Progress entry, 👤 bucket.
- [ ] Tests over mocked fetch: header only without a session; guest toggle with the capability on; sign-in routing with it off or the setting off; cap toast; cache tag changes with the Install.
- [ ] Verified in the preview through the dev router, both themes.
- [ ] Four gates green.
