# Spec: Served Model Capabilities

Status: done
Status note: 2026-10-18. Built as one unit with no tickets. Last landing 68990e170. Closed without gates. Ruling 2026-10-18: Recheck shows in every row state, not only muted.

## Problem Statement

A player who names the model `default` lets the server pick whichever model it has loaded. The app stores what it learned about that model, such as whether it reasons or takes Tools, under the name `default`. When the player loads another model, the app still reads the old answers. The Native Reasoning and Tools rows then hide or disable controls the new model supports, or show controls it does not.

The player has no way to fix this. A stored "no reasoning" or "no Tools" answer is never asked again, except for LM Studio records, which are read again once per session. The player also cannot see which model an answer describes.

The fix must not cost the player money. A paid endpoint bills every completion request, and the fallback capability probe is a completion request.

## Solution

The app reads the real model behind `default` during the reachability check it already runs, and stores capability answers under that real name. Loading another model then gives a new name and a fresh answer. Loading an earlier model again reuses its stored answer with no request. Where the server does not name its model, the app keeps today's behavior.

The Native Reasoning and Tools rows in the Output tab get a **Recheck** button in every state. Recheck reads the served model again, drops what the app stored for it, and asks again. Where the app knows the real name, these rows say which model the answer is for.

## User Stories

1. As a player using LM Studio with `default`, I want the app to notice I loaded another model, so that the Native Reasoning and Tools rows match the model I am using.
2. As a player using a llama.cpp server with `default`, I want the app to notice which model file is loaded, so that capability answers follow the file.
3. As a player who switches between two local models, I want the app to remember each model's answers, so that switching back costs no request.
4. As a player on a paid hosted endpoint, I want capability checks to cost as little as possible, so that I don't pay for settings detection.
5. As a player on a paid hosted endpoint, I want the one-token probe to run at most once per model, so that repeated game starts cost nothing.
6. As a player on a paid hosted endpoint, I want Tools to work without pressing anything, so that a model that takes Tools gets them from the first turn.
7. As a player on the default cloud endpoint, I want today's behavior to stay, so that nothing breaks where the server doesn't name its model.
8. As a player whose Native Reasoning row says my model doesn't reason, I want a Recheck button on that row, so that I can correct a wrong answer.
9. As a player whose Tools row says my model doesn't support Tools, I want a Recheck button on that row, so that I can correct a wrong answer.
10. As a player, I want Recheck next to the setting it affects, so that I don't hunt for it on the endpoint tab.
11. As a player who swapped models mid-session, I want Recheck to read the loaded model first, so that one press fixes the answer.
12. As a player, I want Recheck to clear every stored answer for that model, so that no old answer survives.
13. As a player, I want Recheck to show that it is working, so that I don't press it again.
14. As a player, I want to see which model the Native Reasoning or Tools answer is for, so that I can tell when it describes the wrong model.
15. As a player on an endpoint that doesn't name its model, I want no "checked for default" line, so that the row shows only useful text.
16. As a player with two models loaded in LM Studio, I want the app not to guess which one serves `default`, so that it doesn't store answers under the wrong name.
17. As a player who names a model explicitly, I want nothing to change, so that my setup keeps working.
18. As a player with a prompt routed to another endpoint, I want that endpoint's served model read the same way, so that routed prompts get correct answers too.
19. As a player who upgraded from an earlier version, I want my stored answers to keep working where the app cannot read a real name, so that the upgrade doesn't trigger new paid probes.
20. As a player on the desktop app's bundled engine, I want nothing to change, so that the engine's own report stays the source.
21. As a developer, I want the capability lookups (identity rows, reasoning catalog) to match the real name, so that free sources answer more often and the paid probe runs less.
22. As a developer, I want a record stored under a real name to skip the LM Studio per-session reread, so that the app sends no wasted requests.
23. As a player whose rows say my model reasons or takes Tools, I want Recheck there too, so that the app stops sending reasoning or Tools to a model that no longer takes them.

## Implementation Decisions

**Served model id**

- The text reachability probe returns the served model id next to its outcome. It adds no request on LM Studio, since the probe already reads LM Studio's native list.
- The served id is the real name where the server gives one: the single `state: "loaded"` row on LM Studio, and the loaded model file on a llama.cpp server. Otherwise it is the configured model name.
- A configured name other than `default` is always its own served id. Hosted endpoints name their models explicitly, so their served id never changes.
- LM Studio with two or more models loaded and `default` configured gives no real name. The key falls back to the configured name.
- The default cloud endpoint (Aphrodite) gives no real name. Its `/v1/models` `root` is a fixed deploy path, and no free route names the model. It falls back to the configured name. An engine-start-time fingerprint was considered and rejected.
- Every reachability probe reads the served id: game start, the Main Menu, the setup gate's polling, and the badges for routed prompts.

**Capability cache**

- The capability cache key becomes the endpoint plus the served id. The configured name stays on the wire; only the key and the lookups change.
- The free capability sources (identity rows, the reasoning catalog) match against the served id.
- The LM Studio once-per-session reread applies only to a record under the fallback key. A record under a real name cannot describe another model.
- An automatic resolve still sends the one-token completion probe once per new served id, when no free source answered. This keeps Tools working on hosted endpoints with no manual step.
- Existing records under `<url>|default` stay. They are the fallback key's records, so endpoints with no real name keep their answers after the upgrade. The cache is device storage, not a world or save file, so export shape is untouched.

**Recheck**

- The settings context exposes one recheck operation for a target endpoint. It runs the reachability probe again, so the served id is current. Then it drops the whole record for that id, including a learned schema rejection, clears the session memos for that pair (the resolved-signature set and the completion-probe answers), and resolves again.
- A **Recheck** button goes on the Native Reasoning row and the Tools row in the Output tab, in every state: muted, holding a control, or locked on. A stale yes sends what the model rejects, so Recheck guards both ways. It follows the existing reachability badge's Recheck pattern. It shows a busy state while it runs.
- These rows recheck the active endpoint.
- No Recheck goes on the endpoint tab, the Tools tab notes, or the Formaquestion Tools tab.

**Model name line**

- The two rows show a help line naming the model the answer is for, such as `Checked for g4-meromero-26b-a4b`, only where the server named the model. Copy follows the Writing Guide.

## Testing Decisions

- Tests check behavior a player or a request can see: which requests go out, which record a target reads, and what the rows render. They don't assert on cache key strings or internal memo state.
- **Seam 1: the SettingsProvider with a fake fetch.** Prior art: the LM Studio swap test and the tools-resolve test. It covers:
  - A model swap behind `default` reads a fresh record.
  - Swapping back reuses the old record with no completion request.
  - An explicit name keys by that name.
  - Two loaded LM Studio models fall back.
  - A server with no real name falls back and keeps a pre-upgrade record.
  - The completion probe runs once per served id.
  - Recheck re-probes, drops the whole record, clears the memos, and resolves again.
  - Every guard is proven by reinstating its bug: the `default` key, a kept record after Recheck, and a second paid probe.
- **Seam 2: the Output section render.** Prior art: SettingsSections.test. It covers the Recheck button on both rows in every state, its busy state, and the `Checked for …` line present for a real name and absent for a fallback.
- The reachability probe and the resolver are covered through Seam 1, not on their own.

## Out of Scope

- Detecting a model swap between reachability probes, such as reading the list every turn. Recheck covers it.
- A fingerprint for servers that don't name their model (engine start time, chat-template render).
- Recheck anywhere but the two Output rows.
- Limiting the completion probe to manual Recheck only.
- The desktop app's bundled engine, which reports over IPC.

## Further Notes

- The llama.cpp `/v1/models` shape was confirmed from its server source (`tools/server/server-context.cpp`, master, 2026-10-18), not a live server. Single-model mode lists one row with `owned_by: "llamacpp"` and the alias or file name as `id`. Router mode adds a `status` object per row and never serves `default`, so it falls back. Ollama's lists stay UNVERIFIED and unbuilt.
- The project's agent notes say the cloud's `root` names the model. That stopped being true by 2026-10-18.
- ADR-0008 says Tools go only to endpoints known to support them. This spec keeps that rule and changes only which model "known" refers to.
