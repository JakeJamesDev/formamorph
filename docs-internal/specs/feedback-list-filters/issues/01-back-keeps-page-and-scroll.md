# 01: Back Keeps Page and Scroll

Status: done
Base: 83ac9a5f
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Feedback List Search and Filters](../spec.md)

**Work tree:** this repo only.

**What to build:** A reader opens a thread from page 4 of any feedback list and presses Back. The list returns to page 4 at the same scroll position. When triage moved the thread out and page 4 no longer exists, the list moves to the last page. This applies to the staff queues and the user tabs (Q5).

This is also the prefactor for tickets 03–07. The page moves out of the shared list into the tab that owns the filters. The list takes the page and reports page changes. A filter change still resets to page 1. The tab records the list's scroll position when a thread opens and restores it on Back.

- [x] Back from a thread on page N returns to page N, in the staff queue and in the user tab
- [x] Back restores the list's scroll position
- [x] A reload that returns a page past the end moves to the last page
- [x] A change to status, category, scope, or sort still resets to page 1
- [x] Closing and reopening the dialog starts on page 1 (Q12)
- [x] Tests at the tab seam with `FeedbackService.list` mocked; each guard proved by reinstating the bug
- [x] Changelog line under In Progress
