# 04: Whole-Stat Comparison Errors

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: an AST-shape diagnostic (entry as operand) with more false-positive risk than 03; needs careful negatives.

## What to build

A player who writes `stats.Courage >= 50`, `self + 1` or `if (stats["Hit Points"] > 0)` sees an error underline that says a stat is not a number and suggests `.value`. `stats.Courage.value >= 50`, `self.value + 1`, passing an entry to a function, and reading a member off it raise nothing.

## Acceptance criteria

- [ ] A stat entry (`stats.Name`, `stats["Name"]`, `self`) used as a direct operand of a comparison or arithmetic operator is an error suggesting `.value`
- [ ] Member reads, function arguments and `.value` forms pass with no diagnostic
- [ ] Each test fails with the check removed
- [ ] Not run in parallel with 03; both edit the analysis module
- [ ] Changelog fragment written
