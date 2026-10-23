# Release Step 4d

Apply at merge (ticket 12): insert the section below into the release skill, right before "## 5. Gates".

## 4d. llama.cpp pin

The desktop build bundles `llama-server` from one pinned llama.cpp release tag, in
`scripts/llamaServerPin.json`. A release is when the engine moves to a newer build.

1. Read the newest tag: `curl -s "https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=1"`, field
   `tag_name`. Every llama.cpp release is flagged prerelease, so `releases/latest` is wrong.
2. When it equals the pin, quote "llama.cpp pin is current" and go on.
3. Otherwise ask the user whether to bump. On a yes: set the tag in `scripts/llamaServerPin.json`, run
   `npm run llama-server:fetch`, and re-record the asset list the test reads
   (`scripts/fixtures/llamaServerAssets.<tag>.json`, same `curl` on `releases/tags/<tag>`, asset names sorted).
   A tag that drops one of the mapped assets fails `scripts/fetchLlamaServer.test.mjs`.
4. A bump is not done until two follow-ups pass. Quote each result:
   - the recorded `llama-server` fixtures are re-recorded (ticket 02 of the llama-server-engine spec), so a
     format change fails the parser tests here, not in the viewer;
   - the settings load matrix runs against the new binary (ticket 09 of that spec). It loads models on the GPU,
     so ask the user for a window first (about 2 minutes):
     `node testing/llama-server-matrix/run.mjs --model <small.gguf>`. Quote its last line. Every row must read
     PASS, including `bad-v-q8-fa-off`, which passes when the load fails. The README beside it has the
     packaged-build smoke steps.

