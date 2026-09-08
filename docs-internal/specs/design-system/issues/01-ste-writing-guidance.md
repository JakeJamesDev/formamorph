# 01: Establish STE Writing Guidance

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

**Model rationale:** Interpret the official standard, reconcile local copy conventions, and review terminology and meaning across copy roles. This is a workload recommendation, not a ticket-specific benchmark or an automatic model switch. See the [official model catalog](https://developers.openai.com/api/docs/models/all); recheck availability when starting.

## What to Build

A writer can use a repository guide to produce and review Formamorph functional copy against ASD-STE100, with worked examples and explicit evidence limits.

## Acceptance Criteria

- [ ] Publish authoritative writing guidance for labels, descriptions, instructions, status/errors, and extended help; cover settings, tooltips, confirmations, and tutorials.
- [ ] Consult the actual official writing rules and dictionary. Cite the clauses used and resolve the treatment of label fragments and capitalization before claiming compliance for those examples.
- [ ] Preserve established product vocabulary and document technical terms under the standard's applicable rules; do not replace domain names casually.
- [ ] Retain one-sentence, third-person setting descriptions of at most 12 words, necessary additional detail behind the information control, and imperative instructions. Surface any demonstrated conflict with the standard for a user decision.
- [ ] Provide representative reviewed examples for every copy role, with enough rationale and rule references that another reviewer can verify vocabulary, grammar, and meaning.
- [ ] Keep the target full ASD-STE100. Identify unresolved rules and review limits explicitly; do not substitute an STE-inspired subset or use a model's assurance as compliance evidence.
- [ ] Exclude authored worlds, community posts, and generated story prose from the functional-copy policy.
- [ ] Make the guide usable independently of the live showcase. Do not rewrite unrelated production copy or build a general STE checker.

## Verification

Walk representative examples through the documented review process against the official source. Validate links and terminology consistency. Existing copy checks are local guards, not STE certification.

## Coordination and Scope

Can proceed alongside 02 because it produces the writing reference independently. Ticket 05 applies this guidance to the completed showcase.

Follow the confirmed foundation scope: no app-wide redesign, palette replacement, bulk copy rewrite, version bump, or export-shape change.

## Parent

[Design System Foundation spec](../spec.md)
