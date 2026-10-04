# Ticket gates research

Research notes on cutting the fixed cost of the four prepare gates. Primary sources only; anything else is marked **secondary** or **UNVERIFIED**. Written 2026-10-04.

## Our baseline

| Gate | Command | Cold time on a one-line change |
|---|---|---|
| typecheck | `tsc --noEmit` (TypeScript 6.0.3) | 69 s |
| lint | changed-files eslint | 28 s |
| test | `vitest related --run <changed + triggered>` (Vitest 3.2.6, jsdom) | 1 to 5 min |
| build | `vite build` (Vite 5.4) | 118 s |

Total fixed cost is about four minutes. Live registry versions today: `typescript` 7.0.2, `vitest` 5.0.3, `vite` 8.3.2 (`npm view`, 2026-10-04). The repo is two majors behind on Vitest and three on Vite, so some docs below describe a version we do not run yet. Each such note says which version it covers.

## 1. Affected-test selection

### What `vitest related` and `--changed` do

- `vitest related`: "Run only tests that cover a list of source files. Works with static imports (e.g., `import('./index.js')` or `import index from './index.js`), but not the dynamic ones (e.g., `import(filepath)`). All files should be relative to root folder." ([v3 CLI docs](https://v3.vitest.dev/guide/cli.html), same text in the [current docs](https://vitest.dev/guide/cli.html))
- `--changed`: "Run tests only against changed files. If no value is provided, it will run tests against uncommitted changes (including staged and unstaged)." ([v3 CLI docs](https://v3.vitest.dev/guide/cli.html))
- `forceRerunTriggers`: default `['**/package.json/**', '**/vitest.config.*/**', '**/vite.config.*/**']`. "Glob pattern of file paths that will trigger the whole suite rerun. When paired with the `--changed` argument will run the whole test suite if the trigger is found in the git diff." ([v3 config docs](https://v3.vitest.dev/config/#forcereruntriggers))

### How Vitest 3.2.6 (our version) builds the graph

Source: [`packages/vitest/src/node/specifications.ts` at v3.2.6](https://github.com/vitest-dev/vitest/blob/v3.2.6/packages/vitest/src/node/specifications.ts), read directly.

| Question | Answer from the code |
|---|---|
| Does `forceRerunTriggers` apply to `related`? | **Yes.** `--changed` only fills `config.related` from git. The trigger check runs on `config.related` whichever way it was set: `if (matcher && related.some(file => matcher(file))) return specs`. The docs only mention `--changed`; the code is broader. |
| Where do dependencies come from? | `project.vitenode.transformRequest(filepath)`, then `[...transformed.deps, ...transformed.dynamicDeps]`. So static imports and dynamic imports with a literal specifier are both followed. `import(variable)` has no literal id and cannot appear. |
| How is a dep turned into a path? | `/@fs/` prefix stripped, else `join(project.config.root, dep)`. The result must pass `existsSync` and must not contain `node_modules`. |
| How is a changed file matched? | Exact string equality: `related.some(path => path === specification.moduleId || deps.has(path))`. |
| `?raw` imports | **Inferred, not run:** the dep id keeps its query (`/src/x.txt?raw`), so `join(root, id)` is a path that does not exist on disk and `existsSync` drops it. A change to a `?raw` file does not select the tests that read it. |
| `import.meta.glob` | UNVERIFIED. Vite rewrites globs into imports, but whether the rewritten ids land in `deps`/`dynamicDeps` was not checked. |
| `vi.mock('./x')` | UNVERIFIED. The call is not an import, so it adds nothing by itself; the mocked file is only a dep when the test (or a module under it) also imports it. |
| CSS imports | Followed at file level: the id is a real file, so it passes `existsSync`. Inferred from the same code path. |
| Setup files | Not walked by `getTestDependencies` (it starts from the test's `moduleId` only). Setup-file changes are handled by the watcher, not by `related`. |
| Tests that read files they do not import | Not detectable. The walk sees only transform output. |

Watch mode has a dedicated hook for the last row: `watchTriggerPatterns` (3.2.0+). "Vitest reruns tests based on the module graph which is populated by static and dynamic `import` statements. However, if you are reading from the file system or fetching from a proxy, then Vitest cannot detect those dependencies." ([v3 config docs](https://v3.vitest.dev/config/#watchtriggerpatterns)) In [`watcher.ts` at v3.2.6](https://github.com/vitest-dev/vitest/blob/v3.2.6/packages/vitest/src/node/watcher.ts) it is only consulted by the file watcher, so it does nothing for a one-shot `vitest related --run`. Our prepare script's "triggered paths" list is the same idea, done by hand.

### What changed on `main` (Vitest 5)

[`affected-modules.ts` on main](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/node/affected-modules.ts) replaces the walk above. It uses the Vite module graph, follows `deps` and `dynamicDeps`, tracks `vi.mock` effects (`resolveStaticMocks`), treats "a file imported with a query" as "a separate module", and includes config and setup files. Modules that fail to transform count as affected. It still has no hook for files read at runtime. The docs sentence about dynamic imports is unchanged.

### How Nx and Turborepo handle implicit dependencies

| Tool | Mechanism | Source |
|---|---|---|
| Nx `implicitDependencies` | Project-level list for "dependencies that cannot be deduced through static analysis"; supports names, `!name` negation and globs. | [Project configuration](https://nx.dev/docs/reference/project-configuration) |
| Nx `namedInputs` / `inputs` | Reusable file sets; `{projectRoot}` and `{workspaceRoot}` tokens; `externalDependencies`; inputs "determine whether the task outputs can be retrieved from the cache or the task needs to be re-run." Workspace-level files are declared as `{workspaceRoot}/path` inputs. | [Project configuration](https://nx.dev/docs/reference/project-configuration), [nx.json](https://nx.dev/docs/reference/nx-json) |
| Nx `affected` | Git diff base..head, map changed files to projects through the project graph, add dependents. Lock-file changes mark every project affected unless `projectsAffectedByDependencyUpdates` is tuned. Caveat: a change to a widely used project runs "almost all the projects in the workspace". | [Affected](https://nx.dev/docs/features/ci-features/affected) |
| Nx hash | "Project source files and files from project dependencies", workspace config, external dependency versions, runtime values, command-line args. | [How caching works](https://nx.dev/docs/concepts/how-caching-works) |
| Turborepo `inputs` | Globs relative to the package; defaults to all git-tracked files; setting `inputs` opts out of that default unless `$TURBO_DEFAULT$` is included. | [Configuration](https://turborepo.dev/docs/reference/configuration) |
| Turborepo `globalDependencies` | "If any file matching these globs changes, all tasks will miss cache." | same |
| Turborepo `--affected` | `--filter=...[main...HEAD]` by default; "If any file in a package changed, all of its tasks are selected." Task-level selection by `inputs` needs `futureFlags.affectedUsingTaskInputs`. | [run](https://turborepo.dev/docs/reference/run) |

Both tools solve "depends on a file it does not import" the same way: you declare the extra inputs by hand, per task or per project. Neither infers them.

**What this means for us:** `vitest related` already honors `forceRerunTriggers`, so the "always run" set could move from the prepare script into `forceRerunTriggers` only if we want a full rerun; it has no per-test form. The hand-maintained trigger list is the industry answer, not a workaround. Two likely holes to test: `?raw` imports and `import.meta.glob`.

## 2. Incremental typecheck

### Facts from TypeScript docs and PRs

| Claim | Source |
|---|---|
| `incremental` saves "information about the project graph from the last compilation" to `.tsbuildinfo`; the next run uses it "to detect the least costly way to type-check and emit changes". Files are safe to delete. | [TS 3.4 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html), [tsconfig `incremental`](https://www.typescriptlang.org/tsconfig/incremental.html) |
| `tsBuildInfoFile` sets the location; default is `<config name>.tsbuildinfo` next to the config when no `outDir`/`outFile` is set. | [tsconfig `tsBuildInfoFile`](https://www.typescriptlang.org/tsconfig/tsBuildInfoFile.html) |
| `--noEmit` with `--incremental` is allowed since TypeScript 4.0 ("This was previously not allowed"). | [TS 4.0 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-0.html), [PR 39122](https://github.com/microsoft/TypeScript/pull/39122) |
| Paths in the buildinfo are stored relative to the buildinfo file (merged 2019-06-27). | [PR 31985](https://github.com/microsoft/TypeScript/pull/31985) |
| Since 4.1 the options block can hold `pathsBasePath`, an absolute config-directory path used when `paths` is set without `baseUrl`. | [PR 40101](https://github.com/microsoft/TypeScript/pull/40101) |
| Since 5.6, `--build` "always emits a `.tsbuildinfo` file for any project" even without `incremental`; requests to turn this off were closed "Working as Intended". | [TS 5.6 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-6.html), [issue 60360](https://github.com/microsoft/TypeScript/issues/60360), [issue 62565](https://github.com/microsoft/TypeScript/issues/62565) |

What invalidates the cache: the file carries a `version` field (observed below), and the compiler recomputes from file content hashes stored per file. I could not read the JS builder source today (`raw.githubusercontent.com` returned 404 for `src/compiler/builder.ts` on `main`), so the exact option-change and version-mismatch rules are **UNVERIFIED** here. Treat "same TypeScript version, same options, same tsconfig" as the safe envelope.

### Sharing a buildinfo between worktrees or CI runs

No TypeScript doc or issue found today states that a `.tsbuildinfo` is or is not portable. What the sources do say: paths are relative to the buildinfo file (PR 31985), so a copy placed at the same relative spot in another checkout resolves the same files; `pathsBasePath` is absolute (PR 40101) and our `tsconfig.json` uses `paths` (`@/*`) without `baseUrl`, so that field could differ between worktrees; in the measured run below the stored `options` block did not contain it, so for this config it is not a blocker. Whether an options mismatch forces a full recheck is UNVERIFIED. The Nx team hit the same class of problem in their TypeScript plugin cache (absolute paths breaking shared caches) and fixed it on their side ([nrwl/nx PR 30216](https://github.com/nrwl/nx/pull/30216)); that is about Nx's own cache, not TypeScript's file.

### Measured here

- The repo root already holds `tsconfig.tsbuildinfo` (62 KB, gitignored since commit `4fe8eb81`). Its content is `{ root, errors, version: "6.0.3" }` with no `fileInfos`, so today's `tsc --noEmit` writes the minimal form and reuses nothing.
- Experiment: `tsc --noEmit --incremental --tsBuildInfoFile <scratch>/inc.tsbuildinfo`, run twice on an unchanged tree: 24 s cold, 5 s warm. Details under "Measured incremental run" at the end of this section.

### Project references

[Handbook](https://www.typescriptlang.org/docs/handbook/project-references.html): referenced projects need `composite: true`, which forces `declaration: true` and requires every file to be listed by `include`/`files`; importers load the referenced project's `.d.ts` instead of source; `tsc -b` checks timestamps and rebuilds only out-of-date projects; after source-control operations "you may need `tsc -b --force`". Since 5.6, `--build` continues past upstream errors and `--noCheck` can skip checking during emit ([TS 5.6 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-6.html)). This is a restructure (split `src/`, `site/`, `e2e/` into composite projects with declaration output), not a flag.

### tsgo / TypeScript 7

| Date | Statement | Source |
|---|---|---|
| 2025-03 | Native port announced; "reduce most build times by 10x"; VS Code 77.8 s to 7.5 s. | [A 10x Faster TypeScript](https://devblogs.microsoft.com/typescript/typescript-native-port/) |
| 2025-05 | `@typescript/native-preview` on npm, `tsgo` command; `--build`, `--declaration` emit not yet supported. | [Announcing TypeScript Native Previews](https://devblogs.microsoft.com/typescript/announcing-typescript-native-previews/) |
| 2025-12 | "Features like `--incremental`, project reference support, and `--build` mode are also now all ported over and working!" sentry 133 s to 16 s, vscode 89 s to 8.7 s. | [Progress on TypeScript 7, December 2025](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025) |
| 2026-03-23 | 6.0 is "the last release based on the current JavaScript codebase". | [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) |
| 2026-07-08 | 7.0 released; the `typescript` npm package ships the native `tsc`; 7.7x to 11.9x on full builds; "TypeScript 7.0 ... does not ship with an API", 7.1 will; Vue/MDX/Astro/Svelte tooling "will likely not yet be able to leverage TypeScript 7". | [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) |

`npm view typescript version` is 7.0.2 today; we are on 6.0.3. Anything in our toolchain that uses the TypeScript API (typescript-eslint, Vite plugins that type-check, editors) is the compatibility question; the `tsc` CLI itself is the drop-in part.

**What this means for us:** the cheapest experiment is `--incremental` on the existing `tsc --noEmit` (one flag plus a buildinfo path per worktree). The largest saving is TypeScript 7's native `tsc`, which Microsoft's own numbers put near 10x on full checks; the blocker to check is API consumers, not the CLI. Project references are a restructure and should wait until the two cheap options are measured.

## 3. Where the production build belongs

### Merge queues: what runs on the PR and what runs on the batch

| System | Per PR | On the merge candidate / batch | Failure handling | Source |
|---|---|---|---|---|
| GitHub merge queue | "Once a pull request has passed all required branch protection checks, a user with write access ... can add the pull request to the queue." | A `merge_group` is "the latest version of the `base_branch` as well as changes from pull requests ahead of it in the queue"; "You **must** use the `merge_group` event"; group size 1 to 100 with a wait timeout. | Failing groups are removed; with "Only merge non-failing pull requests" off, failed PRs ride along if the last PR in the group passed. | [Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) |
| Graphite | Option: "Run CI on each PR in the stack individually" or "Run CI on the topmost PR in the stack". | Batching (private beta) and "speculative execution ... to run CI for multiple enqueued stacks at the same time". | Default: every stack re-checked in parallel; or bisection, "each iteration verifies half of the remaining stacks as safe". | [Merge queue optimizations](https://www.graphite.com/docs/merge-queue-optimizations); mechanics also in a Graphite blog post, **secondary**: [merge queue batching](https://graphite.com/blog/merge-queue-batching) |
| Mergify | Normal PR checks. | `batch_size` PRs combined into "a batch pull request ... validated by your CI system"; the originals are what merge. | "If a batch fails, all subsequent batches are deemed to fail as well"; the failed batch is split into `max_parallel_checks` parts, minimum two. | [Batches](https://docs.mergify.com/merge-queue/batches/) |
| bors-ng | `pr_status`: statuses "that must pass on the PR commit when it is r+-ed". | `status`: statuses on the merge commit on `staging`; `max_batch_size` caps the batch; main "gets fast-forwarded" to the tested commit. | "it splits the batch into two batches, and pushes those to the queue" (bisecting). | [Reference](https://bors.tech/documentation/), [Getting started](https://bors.tech/documentation/getting-started/), [README](https://github.com/bors-ng/bors-ng) |

Is "typecheck + tests per change, full build on the candidate" a documented pattern? Not in these words. The closest primary evidence is structural: bors-ng keeps two separate status lists (`pr_status` for the PR commit, `status` for the staging commit), GitHub exposes `merge_group` as its own event so a workflow can run different jobs there than on `pull_request`, and Graphite offers CI on only the topmost PR of a stack. Every system still runs the full required set on the candidate before trunk moves; the per-PR set is the one that gets thinned.

### Vite build caching

- Vite 5 build docs describe `vite build --watch` and `build.watch`; "With the `--watch` flag enabled, changes to the `vite.config.js`, as well as any files to be bundled, will trigger a rebuild." No cache for one-shot production builds is documented. ([Vite 5 build guide](https://v5.vite.dev/guide/build.html))
- Current Vite (Rolldown-based) docs: same `--watch` story, `build.rolldownOptions`; still no persistent build cache. ([Vite build guide](https://vite.dev/guide/build.html))
- The persistent-cache plugin PR was closed 2025-02-07: "Caching would make more sense to be done directly in rolldown in the future". ([vitejs/vite PR 14333](https://github.com/vitejs/vite/pull/14333))
- Rolldown persistent cache status: UNVERIFIED (no rolldown.rs page surfaced in search today).

So `vite build` is not incremental and cannot be made so with a flag in Vite 5 or 8. `--watch` only helps a long-running process, which does not fit a per-ticket worktree.

**What this means for us:** every queue tested here re-validates the merged candidate, and none documents dropping a check at that stage. The documented room is on the per-change side. For us that reads as: keep all four gates on the landing step, and ask which of them a ticket worktree needs before it is allowed to queue.

## 4. Tiering gates by change class

- GitHub Actions `paths` / `paths-ignore` filter `push` and `pull_request` runs; the two are mutually exclusive on one event; both branch and path filters must match; "Path filters are not evaluated for pushes of tags." ([Workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions))
- Large diffs: when the diff exceeds the file limit and the matched file is past it, "the workflow will **not** run." (same page)
- The caveat with required checks: "If a workflow is skipped due to path filtering, branch filtering, or a commit message, then checks associated with that workflow will remain in a 'Pending' state. A pull request that requires those checks to be successful will be blocked from merging." ([Trigger a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)) GitHub's advice: "Avoid requiring workflows that can be skipped." ([Troubleshooting required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/troubleshooting-required-status-checks))
- Nx and Turborepo skip by project graph and declared inputs (section 1). Nx warns that a change in a widely used project runs nearly everything; Turborepo's `globalDependencies` makes a matching change miss every cache.

Documented risks of skipping the build for tests-only or docs-only changes: none of the primary sources above states one beyond the pending-check trap. The risks that apply here come from our own layout, not from a doc:

- Our `tsconfig.json` `include` covers `src`, `site`, `e2e` and two config files, so a tests-only change still needs `typecheck`; only `build` and (for files nothing imports) `test` could be skipped.
- Docs are bundled into the app for the Formaquestion help window (memory: "help window answering from bundled docs"), so a docs-only change can change the build output and the tests that read those files. A docs-only tier must exclude whatever directory that bundling reads. Verify the glob before trusting the tier.

**What this means for us:** the prepare script, not GitHub, decides which gates run, so the pending-check trap does not bite us; the real work is a correct change-class classifier whose "skip" rules are derived from `tsconfig.include`, the Vite entry graph, and the help-docs bundle path.

## 5. Vitest performance for large jsdom suites

Docs quoted are v3 unless marked; the performance guide numbers come from the current (v5.0.3) docs and were not present in the v3 guide.

| Option | Doc text | Source |
|---|---|---|
| `pool` | `'threads' | 'forks' | 'vmThreads' | 'vmForks'`, default `'forks'`. threads "runs every test file in a separate Worker"; forks "in a separate forked child process"; vmThreads "in a separate VM context, but it uses workers for parallelism". | [v3 config](https://v3.vitest.dev/config/#pool), [v3 performance](https://v3.vitest.dev/guide/improving-performance.html) |
| `isolate` | default `true`; "Run tests in an isolated environment. This option has no effect on `vmThreads` and `vmForks` pools." Performance guide: isolation "greatly increases test times, which might not be desirable for projects that don't rely on side effects and properly cleanup their state." | [v3 config](https://v3.vitest.dev/config/#isolate), [v3 performance](https://v3.vitest.dev/guide/improving-performance.html) |
| `isolate: false` pitfalls | On `singleThread`/`singleFork`: "your tests will run sequentially, but in the same global context, so you must provide isolation yourself." The runner only calls `mocker.reset()` and `resetModules(...)` per file when `isolate` is true, so module state and mocks carry across files otherwise. | [v3 config](https://v3.vitest.dev/config/#pooloptions-threads-singlethread), [runBaseTests.ts](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/runtime/runBaseTests.ts) |
| `fileParallelism` | default `true`; "Setting this to `false` will override `maxWorkers` and `minWorkers` options to `1`." | [v3 config](https://v3.vitest.dev/config/#fileparallelism) |
| `maxWorkers` / `poolOptions.threads.maxThreads` | number or percentage; default is available CPUs. | [v3 config](https://v3.vitest.dev/config/#maxworkers) |
| `deps.optimizer` | "Enable dependency optimization. If you have a lot of tests, this might improve their performance." Only packages in `include` are bundled; web mode is used for jsdom and happy-dom. | [v3 config](https://v3.vitest.dev/config/#deps-optimizer) |
| `environment` cost | "DOM environments are expensive to create: `jsdom` costs roughly 200-500ms per import and `happy-dom` roughly 90-200ms"; "`happy-dom` is cheaper to create than `jsdom` in every setup." Example breakdown: "Duration 3.76s (environment 79%, import 13%, transform 6%, tests 1%, setup 1%)". | [current performance guide (v5)](https://vitest.dev/guide/improving-performance.html) |
| vmThreads | "Use `vmThreads` when every file needs a fresh `window` and the per-file environment cost dominates the run." Cannot disable isolation under it. | same, [v3 performance](https://v3.vitest.dev/guide/improving-performance.html) |
| Fastest documented combination | "Prefer `isolate: false` with `threads` if the tests tolerate shared state: it is the fastest option and keeps memory behavior simple." | [current performance guide (v5)](https://vitest.dev/guide/improving-performance.html) |
| `--bail` | "Stop test execution when given number of tests have failed (default: `0`)". | [v3 CLI](https://v3.vitest.dev/guide/cli.html) |
| `--shard` / `--merge-reports` | `--shard=<index>/<count>` splits "your test files, not your test cases"; combine with `--reporter=blob` and merge with `--merge-reports`. | [v3 CLI](https://v3.vitest.dev/guide/cli.html), [v3 performance](https://v3.vitest.dev/guide/improving-performance.html) |
| `--reporter` (v3) | default, basic, blob, verbose, dot, json, tap, tap-flat, junit, hanging-process, github-actions. | [v3 CLI](https://v3.vitest.dev/guide/cli.html) |
| `dir` | "Base directory to scan for the test files." Narrows discovery. | [v3 config](https://v3.vitest.dev/config/#dir) |

### Version differences

| Version | Change | Source |
|---|---|---|
| 1.0 | `--threads` became `--pool=threads`, `--no-threads` became `--pool=forks`, `--single-thread` became `--poolOptions.threads.singleThread`; `poolMatchGlobs` renamed. | [v1 migration](https://v1.vitest.dev/guide/migration.html) |
| 2.0 | "Vitest 2.0 changes the default configuration for `pool` to `'forks'` for better stability." Hooks run serially. | [v3 migration page, 2.0 section](https://v3.vitest.dev/guide/migration.html) |
| 3.0 / 3.2 | Fake-timer defaults changed; 3.2 added `watchTriggerPatterns`; `workspace` renamed `projects`. | [v3 migration](https://v3.vitest.dev/guide/migration.html), [v3 config](https://v3.vitest.dev/config/#watchtriggerpatterns) |
| 4.0 | Tinypool removed; "maxThreads and maxForks are now maxWorkers"; "singleThread and singleFork are now maxWorkers: 1, isolate: false"; "poolOptions is removed. All previous poolOptions are now top-level options"; `vmMemoryLimit`; `deps.optimizer.web` renamed `deps.optimizer.client`; vite-node replaced by Module Runner. | [v4 migration](https://v4.vitest.dev/guide/migration.html) |
| 5.0 | Worker ids start at 1; jsdom/happy-dom `globalThis` assignments propagate to the DOM implementation; `json`/`junit` reporters write files by default; `clearMocks` on by default. | [current migration](https://vitest.dev/guide/migration.html) |

**What this means for us:** on 3.2.6 the levers are `pool: 'threads'` plus `isolate: false` (fastest per the docs, but it surfaces every leaked mock or module-level singleton across ~1,500 files), `deps.optimizer` for heavy UI packages, and a `jsdom` to `happy-dom` trial on the environment-dominated files. The environment share of our `vitest related` run should be read from its own Duration line before choosing; a 19 + 19 file run where environment is 79% says the per-file jsdom boot is the cost, not the tests.

## Options for this repo

Savings are against the ~4 min fixed cost of a one-line ticket. "Expected" rows are reasoned from the sources, not measured, unless marked measured.

| Option | Expected saving on a one-line change | Risk | Source |
|---|---|---|---|
| `tsc --noEmit --incremental` with a per-worktree `tsBuildInfoFile` | **Measured:** 24 s cold to 5 s warm on an unchanged tree. A fresh worktree pays the cold run once unless the buildinfo is seeded. | Seeding across worktrees is undocumented; `pathsBasePath` is absolute. Stale-cache false greens are the failure to test for. | [TS 4.0 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-0.html), [PR 31985](https://github.com/microsoft/TypeScript/pull/31985), [PR 40101](https://github.com/microsoft/TypeScript/pull/40101) |
| TypeScript 7 native `tsc` | ~69 s to roughly 7 to 9 s if Microsoft's 7.7x to 11.9x holds | No API in 7.0; typescript-eslint and any plugin on the TS API stay on 6.x until 7.1. Two compilers in one repo. | [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) |
| Move "always run" tests into `forceRerunTriggers` | None (it widens to the full suite). Keep the hand list; add `?raw` and glob sources to it after testing the holes. | A missed trigger is a silent skip. | [specifications.ts v3.2.6](https://github.com/vitest-dev/vitest/blob/v3.2.6/packages/vitest/src/node/specifications.ts) |
| `pool: 'threads'`, `isolate: false` for the `related` run | Up to the environment share of the run (docs example: 79%) | Cross-file leaks of mocks and module singletons; needs a full-suite run under the same flags to prove green. | [performance guide](https://vitest.dev/guide/improving-performance.html) |
| `happy-dom` for environment-bound files | Per-file boot drops from "200-500ms" to "90-200ms" | API gaps versus jsdom; per-file `// @vitest-environment` keeps it opt-in. | same |
| Build only on landing, not in every worktree prepare | ~118 s per ticket | A ticket that breaks the bundle is found at landing, not before. Every queue surveyed still builds the candidate; none skips it. | [GitHub merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue), [bors reference](https://bors.tech/documentation/) |
| Change-class tiers (docs-only, tests-only) | 118 s (build) for tests-only; up to the full 4 min for docs-only outside the bundled help path | Classifier must mirror `tsconfig.include`, the Vite entry graph and the help-docs bundle; GitHub's pending-check trap does not apply since the prepare script owns the decision. | [Workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions), [Troubleshooting required checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/troubleshooting-required-status-checks) |
| Project references | Unknown; only pays when a touched project is small and its dependents are few | Composite + declaration emit restructure of `src/`, `site/`, `e2e/`; timestamp sensitivity after checkouts. | [Project references](https://www.typescriptlang.org/docs/handbook/project-references.html) |
| Vite build cache | None available | Not a Vite feature in 5.x or 8.x; deferred to Rolldown. | [vitejs/vite PR 14333](https://github.com/vitejs/vite/pull/14333) |

### Measured incremental run

Run on 2026-10-04 on the main checkout, unchanged tree between runs, TypeScript 6.0.3, buildinfo written to the scratchpad on `C:` (the repo is on `D:`).

| Run | Wall time | Exit |
|---|---|---|
| Cold (`--incremental`, no buildinfo yet) | 24 s | 0 |
| Warm (same command, nothing changed) | 5 s | 0 |

Note the cold run took 24 s, not the 69 s quoted for the gate. Either the gate's 69 s includes contention from a parallel prepare, or the number is stale; measure the gate itself before quoting a saving. The buildinfo was 1.1 MB with keys `fileNames`, `fileIdsList`, `fileInfos`, `root`, `options`, `referencedMap`, `affectedFilesPendingEmit`, `version`; 5,266 files, each with a 64-hex content hash in `fileInfos[].version`. That hash is the per-file invalidation key, observed first-hand. The stored `options` block held only `allowJs`, `checkJs`, `jsx`, `module`, `skipLibCheck`, `strict`, `target`, `tsBuildInfoFile`, `useDefineForClassFields`; no `paths` or `pathsBasePath` appeared for this config.

Portability observation: because the buildinfo lived on a different drive from the sources, every `fileNames` entry was written as an absolute lowercase path (`d:/documents/github/formamorph/...`). PR 31985's relative form cannot cross drives. Keep the buildinfo on the same drive as the worktree, and expect a buildinfo copied between worktrees at different absolute paths to describe the wrong files unless its own location is the same relative distance from them. Whether TypeScript then detects the mismatch or silently reuses stale state is UNVERIFIED; test it by seeding a worktree with another worktree's file and introducing a type error.
