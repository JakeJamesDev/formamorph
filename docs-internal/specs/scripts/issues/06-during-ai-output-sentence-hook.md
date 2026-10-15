# 06: During AI Output Sentence Hook

Status: done
Blocked by: 01
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

Fable at high: the narration stream becomes async per sentence, every downstream copy is rebuilt, and the ordering must hold under a slow script.

## What to build

A script with timing During AI Output runs once each time a narration sentence completes, in the stream, before the sentence reaches the reveal, TTS or the save (R4). It reads `narration.sentence`, `narration.full` and `narration.index`, and may assign `narration.sentence` or return a string. The result is one sentence whatever it holds (Q27). The display text, the persisted partial, the TTS sentence events and the final text all carry the rewritten sentences, so the screen, the save and the AI's recap are one copy (Q2). Sentences run in order; a slow script never reorders them. A script that throws or times out passes its sentence unchanged and logs (Q22). A Blueprint stat's script runs once per owner per sentence (Q29). `player.*` fails the script in this timing (Q14). `narration.sent` and `narration.buffered` ship in ticket 07.

Spec: R4, Q2, Q14, Q20, Q22, Q27, Q29, story 8.

## Acceptance criteria

- [ ] A script that wraps a word in a markdown link shows the link in the reveal, in the saved turn and in the next request's last story
- [ ] Sentences arrive in order with a script that sleeps on even indexes; a test asserts the final text order
- [ ] A thrown error leaves the sentence as the model wrote it and the error reaches the log with the script's name and timing
- [ ] A returned string holding two sentences releases as one reveal unit and one TTS unit
- [ ] A During AI Output script that calls `player.ask` fails with an error naming the timing
- [ ] Four gates green

## Blocked by

- 01
