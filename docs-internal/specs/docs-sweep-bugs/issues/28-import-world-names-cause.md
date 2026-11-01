# 28: World Import Names the File and the Cause

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: sets the shared report and the copy that ticket 29 reuses.

## What to build

A failed world import reads "Imported 0 worlds (1 skipped)." The file name and the cause go only to the console, even when storage is full. Ruling Q23: one skipped file shows its name and the cause. Several skipped files keep the count, and **View Details** lists each file with its cause. Text the app wrote for the player shows on the line. A raw parser or storage message stays in **View Details**, behind a written line.

This ticket owns the shared import report. Ticket 29 moves the other kinds onto it.

Spec: Q23. Evidence: the error audit after this spec's close.

## Acceptance criteria

- [ ] A test that imports one bad world file fails today (only the count), then passes with the file name and the cause
- [ ] Several skipped files show the count, and View Details lists each file and cause (test)
- [ ] A storage failure on one world names the file, and its raw message is only in View Details (test)
- [ ] A clean import of several files keeps today's summary, and a lone success still shows no toast (test)
- [ ] The new copy follows the Writing Guide; the copy sweep ran on it
- [ ] A changelog fragment under Minor / Fixed / 👤
