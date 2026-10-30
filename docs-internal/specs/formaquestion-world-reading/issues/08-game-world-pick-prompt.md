# 08: Game World Pick Prompt

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a one-line prompt change that must ship with probe numbers.

## What to build

The world pick request tells the model its sections are "the parts of the world open in the World Editor". The game sends the same line over Player View rows. In game, the line names what the list really holds: what the player has met. The editor line stays as it is, so editor picks don't move.

Found in the close review. Spec: "Player View rows form a game World Index, ranked like the editor pool (keyword, its own pick request, semantic)".

## Acceptance criteria

- [x] A game world pick request carries a game line; an editor world pick request is byte-equal to today's (gameWorld test "names the list as what the player has met"; editorWorld test pins the full editor pick body as a literal; the game test fails with the game branch removed)
- [x] The guide pick request is byte-equal with and without a world open (editorWorld and gameWorld tests "sends the guide pick request with the same body")
- [x] `probe:world-question` game arm, before and after, cloud default, 5 runs per arm, recorded in the ticket (one batch, old line as its own arms per the spec session; table below)

## Probe

`npm run probe:world-question -- --runs 5 --arms shipped,oldline,full,fullold --only <the 21 game cases>`, cloud default (root `/home/fiery/gemma_deploy/model`), 2026-10-30, on main after ticket 10 (06b5a405a). 420 questions in 729 s, 0 failed. `oldline` and `fullold` send the game pick request with the World Editor line, in the same batch.

| Arm | n | correct | facts | leak | opinion |
|---|---|---|---|---|---|
| shipped (game line) | 105 | 74% | 80% | 0% | 66% |
| oldline (editor line) | 105 | 73% | 76% | 0% | 71% |
| full (game line) | 105 | 49% | 55% | 21% | 83% |
| fullold (editor line) | 105 | 47% | 54% | 19% | 83% |

The line change is neutral within the cloud model's spread. It makes the request truthful and moves no score. The game line drops the lore clause, because ticket 10 left fired lore out of the pick pool.

## Landed

**Not verified**
- None.

**For you**
- None: the change is one pick-request line, with no visible surface.
