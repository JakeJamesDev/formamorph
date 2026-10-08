# 05: Auto Save Settings

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: two Settings rows that follow the existing off-state pattern and copy rules.

Parent: [World Editor Auto Save spec](../spec.md)

## What to build

Authors tune auto save in Settings.

- Two rows sit next to **Authoring Tour**: the **Auto Save** toggle and an idle-pause slider from 10 s to 5 min, default 30 s.
- The toggle and the Save-menu checkbox are one preference. Changing either shows in the other.
- The slider hides when Auto Save is off, per the settings off-state pattern.
- The change threshold stays fixed; it has no control.
- Copy follows the Writing Guide (brief line, ⓘ) and goes through a copy sweep.

Rulings: Q8, Q16, Q21, Q25, Q26.

Handoff from 04: the idle pause is the `AUTO_SAVE_IDLE_MS` constant in the auto save scheduler. This ticket turns it into the setting.

## Acceptance criteria

- [ ] Settings shows the Auto Save toggle and the idle slider beside Authoring Tour.
- [ ] The Settings toggle and the Save-menu checkbox stay in sync.
- [ ] The slider hides when Auto Save is off.
- [ ] The scheduler uses the chosen pause.
- [ ] Copy passes the copy sweep.
- [ ] Changelog fragment written.
