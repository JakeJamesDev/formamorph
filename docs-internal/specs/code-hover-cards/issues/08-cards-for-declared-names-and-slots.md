# 08: Cards For Declared Names And Slots

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Two small card kinds from data the analysis already has. Sonnet at medium.

## What to build

A name the code declares gets a card with its kind, such as `(const) tired`, and a Go to Line link that moves the caret to the declaration. No inferred type. In the template dialog, a slot gets a card with its type and default.

Spec: Q14, Q18.

## Acceptance criteria

- [ ] A declared name's card shows its kind, and Go to Line moves the caret
- [ ] A slot's card shows its type and default
- [ ] Changelog fragment; four gates green

## Blocked by

- 02
