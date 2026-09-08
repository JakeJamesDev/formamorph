# 01: Establish STE Writing Guidance

Status: ready-for-human
Status note: Guide reviewed; user approved the documentation commit with the existing test-gate failure recorded below.
Blocked by: None (can start immediately)
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

**Model rationale:** Interpret the official standard, reconcile local copy conventions, and review terminology and meaning across copy roles. This is a workload recommendation, not a ticket-specific benchmark or an automatic model switch. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A writer can use a repository guide to produce and review Formamorph functional copy against ASD-STE100, with worked examples and explicit evidence limits.

## Acceptance Criteria

- [x] Publish authoritative writing guidance for labels, descriptions, instructions, status/errors, and extended help; cover settings, tooltips, confirmations, and tutorials.
- [x] Consult the actual official writing rules and dictionary. Cite the clauses used and resolve the treatment of label fragments and capitalization before claiming compliance for those examples.
- [x] Preserve established product vocabulary and document technical terms under the standard's applicable rules; do not replace domain names casually.
- [x] Retain one-sentence, third-person setting descriptions of at most 12 words, necessary additional detail behind the information control, and imperative instructions. Surface any demonstrated conflict with the standard for a user decision.
- [x] Provide representative reviewed examples for every copy role, with enough rationale and rule references that another reviewer can verify vocabulary, grammar, and meaning.
- [x] Keep the target full ASD-STE100. Identify unresolved rules and review limits explicitly; do not substitute an STE-inspired subset or use a model's assurance as compliance evidence.
- [x] Exclude authored worlds, community posts, and generated story prose from the functional-copy policy.
- [x] Make the guide usable independently of the live showcase. Do not rewrite unrelated production copy or build a general STE checker.

## Verification

Walk representative examples through the documented review process against the official source. Validate links and terminology consistency. Existing copy checks are local guards, not STE certification.

## Coordination and Scope

Can proceed alongside 02 because it produces the writing reference independently. Ticket 05 applies this guidance to the completed showcase.

Follow the confirmed foundation scope: no app-wide redesign, palette replacement, bulk copy rewrite, version bump, or export-shape change.

## Parent

[Design System Foundation spec](../spec.md)

## Comments

### Implementation review — September 7, 2026

- Added the independent [Functional Writing Guide](../../../../docs/Writing-Guide.md), with official rule/dictionary references, a product-term register, role-specific examples, and a full-standard review record.
- Retained local Title Case and complete third-person setting descriptions of at most 12 words. Standalone label-fragment grammar remains explicitly unverified; the guide does not claim compliance for those labels. No production copy was rewritten.
- Standards review: no findings. Spec review: one dictionary-meaning mismatch corrected; follow-up review confirmed no remaining findings.
- Verified all 5 local links, 12 PDF page anchors, 8 dictionary printed-page references, and 8 example word counts. Official PDF and download-page links were accessible.
- Isolated verification used starting commit d2cd950d plus the guide: typecheck passed (14.4 s), lint passed (12.8 s), build passed (43.5 s). Vitest ran in 58.0 s: 514 files and 8,467 assertions passed, 3 tests skipped, but exited 1 with a FeedbackList async update after teardown (window is not defined, FeedbackList.tsx:85). The test gate is not green. Aggregate test time was 360.4 s across parallel workers; wall time was 58.0 s, with no idle-tail gap demonstrated.
- The shared-checkout test attempt took 112.4 s and also discovered an existing scratch prototype as test input (1,053 files); ongoing ticket 02 edits affected that run. The isolated source checkout avoids those unrelated inputs without changing test cases or fixtures.
- No code, export shape, or version changed. Graph update and UI verification do not apply to this documentation slice. Ticket 02 owns the coordinated shared changelog entry.
- User approved committing this documentation-only slice with the existing test-gate failure recorded. That exception does not mark the test gate green or authorize an unrelated code fix.
