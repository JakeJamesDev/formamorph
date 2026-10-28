# Willow launch runbook

Status: draft, 2026-10-28. Willow is the first Supporter Mascot. The client release and the server deploy go live together.

▶ Resume here: settle the three open checks, then run the launch steps in order.

## What goes live

| Side | What | State on 2026-10-28 |
|---|---|---|
| 🖥️ Client | Mascots section, Mascot publish, Supporter Mascots in the Mascot tab, Supporter-only buttons | On `main`, unreleased (In Progress) |
| 🗄️ Server | Mascot kind, pins, Supporter-only gate, watermark + scramble, `read-leak` | 16 commits on `main` past the last deploy (`a0c0689`), through `3a53641` |

## ⚠️ Open checks (before launch day)

1. **Publish window → server script (ruled 2026-10-28).** A staff publish from the app goes live at once, public and unwatermarked until the Supporter-only toggle. So Willow skips the app: a server script creates the listing already Supporter-only (step 3). No UI surface for now. Built: `npm run publish-supporter` (FormamorphServer `src/utils/publishSupporter.js`, `docs-internal/server.md` "Publishing a Supporter Mascot").
2. **3.5.0 clients on the new server.** UNVERIFIED: whether a 3.5.0 client lists a Mascot listing in **All**, and what its Download does. This decides whether Willow can be published before the client release.
3. **Client build time.** UNVERIFIED: minutes from the GitHub release to live web and desktop builds. This sets the gap between the server deploy and the announcement.

## Launch steps

### 1. Prep (any day before)

- Willow's art: every layer is original. Publish refuses a Mascot that holds a Morphie layer (Q29).
- Listing thumbnail ready. The art never goes in a repo.
- The upload script is built and tested in FormamorphServer. It ships in the same server deploy.
- Server tests green on `main`. Note the count and wall time for the deploy log.
- Run the release skill's fingerprint step. It copies `bundledFingerprints.json` to the server repo. Commit that with the server batch.

### 2. Deploy the server

1. Pre-deploy backup, same pattern as the deploy log (`backups/pre-deploy-<sha>-<time>.db`, integrity `ok`).
2. Push the server repo from GitHub Desktop.
3. On the server:

   ```bash
   cd /srv/formamorph/app && git pull && npm ci --omit=dev && sudo systemctl restart formamorph-api
   ```

   `npm ci` takes about 4 minutes. `sharp` is a new dependency.
4. Wait 6 s. Check `systemctl is-active formamorph-api`, the journal (`Server running on port`, the schema steps `pinnedAt`, `promptAppVersion`, `supporterContent`) and a public route (200).
5. Add a deploy log entry to `FormamorphServer/docs-internal/server.md`.

- No new env keys. The watermark seed comes from `JWT_SECRET`.
- All three schema steps only add columns, so a code rollback needs no database restore.
- ⚠️ A rollback serves Supporter-only listings on the public route again: old code ignores the `supporter_only` column.

### 3. Upload Willow on the server

1. Export Willow from the Mascot tab of a dev build. Copy the file and the thumbnail to the server. Never commit them.
2. Run `npm run publish-supporter -- /tmp/willow.webp --author <your staff username>` on the server. It creates the listing Supporter-only, pinned and approved in one transaction, with the content in `supporter-private`. Then delete the copied `.webp`: it holds every layer unwatermarked.
   - ⚠️ The script does not check for Morphie layers, as the app's publish does (Q29). Confirm Willow uses only original art.
3. Check three accounts:
   - Signed out → **Sign In**.
   - Signed-in non-supporter → **Patreon**, and a locked entry in the Mascot tab.
   - Supporter → **Install**, then Willow is selectable and read-only.
4. Screenshot the Supporter's installed Willow. On the server, `npm run read-leak -- <file>` must name that account.

### 4. Cut the client release

1. Run the release skill (version, changelog, gates, Discord text).
2. Commit, tag `v<version>`, push and create the GitHub release from GitHub Desktop and GitHub. This starts the desktop and web builds.
3. Confirm the web build is live and the desktop assets are on the release.

### 5. Announce

Post the Discord message after steps 2–4 are all live.

## Rollback

| Problem | Do |
|---|---|
| Server won't start | Read the journal; `git checkout a0c0689`, `npm ci`, restart. Unpublish Willow first (see the ⚠️ above). |
| Willow leaks | `npm run read-leak -- <file>` names the account; revoke its Supporter content access. |
| Client build fails | The server stays up. 3.5.0 clients keep working (pending check 2). |
