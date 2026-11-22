# 03: Learned Speaker Names

Status: ready-for-agent
Blocked by: 01, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

When a player fixes a quote's speaker, the playthrough learns what that title means, so later turns get it right without another fix.

**Learning:**
- The playthrough learns a head word for an entity when both of these hold:
  - a quote correction names that entity;
  - the quote's speaker mention sits in a cluster the reading left unnamed. The speaker mention is the speech-tag subject or the beat opener, taken from 01's rule mention, which 05 keeps in saved turns.
- The head word is the mention's last word, lowercased, past any possessive ("alpha" from "the massive black-furred Alpha").
- A capitalized name outside the cast is learned whole, lowercased.
- Pronouns and player words are never learned.
- A head word that two entities claim is dropped.

**Storage:** learned names are derived from the save's corrections, turn by turn, so an undo removes them with the turn. Nothing new is stored.

**Use in the reading:**
- The reading takes learned names as an input.
- A learned name names a cluster only when all of these hold:
  - the cast vote left the cluster unnamed;
  - the player rule did not claim it;
  - the cluster holds the head word.
- A learned name never changes a cluster that the vote named.
- Mentions carry entity ids only, so an unmet stranger still shows under its stranger label.

Raise `readingVersion`.

Changelog: add a fragment for the change players see, which is that a speaker fix carries over to later turns.

## Acceptance criteria

- [ ] After a speaker fix on a descriptor-only cluster, a later turn's cluster with the same descriptor gets that entity, and its quotes get that speaker.
- [ ] A cluster that the cast vote named keeps its entity when a learned name disagrees.
- [ ] A head word fixed to two different entities names nothing.
- [ ] Undoing the corrected turn removes the learned name from later readings.
- [ ] A learned unmet stranger shows its stranger label, never its true name, on its quotes and cards.
- [ ] Pronoun and player-word speaker mentions teach nothing.
