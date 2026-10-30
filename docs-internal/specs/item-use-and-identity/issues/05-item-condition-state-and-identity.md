# 05: Item Condition: State and Identity

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A Requirement Row that checks an item can also require a State word, and require the item identified or unidentified. Both are optional and combine with Not. Traits, image rules and equip requirements all read the same check, so a lantern can grant Darkvision only while its State is "lit".

Spec: What each reader shows (Requirement Rows); Q22.

## Acceptance criteria

- [ ] An item row can set a State word; it holds only for a matching copy
- [ ] An item row can require identified or unidentified
- [ ] Both combine with owned or equipped, the owner, and Not
- [ ] The Requirement Row editor shows both fields on an item row
- [ ] The glossary entry for Item Condition and the wiki page that documents Requirement Rows describe the new checks

## Blocked by

- 02
- 03
