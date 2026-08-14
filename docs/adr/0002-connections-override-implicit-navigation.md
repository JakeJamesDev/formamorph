# ADR-0002 — A Connection between a pair replaces that pair's implicit navigation

**Status:** Accepted · **Date:** 2026-08-13

## Context

Locations get free navigation from containment — a location reaches its parent, its children, and its siblings (top-level locations are not siblings of each other). The Location Graph feature adds authored Connections: world-level records `{from, to, twoWay, aiHint?}` linking any two locations, one-way or two-way.

The two systems collide on pairs the tree already connects. If implicit navigation always survives, a one-way Connection between siblings is meaningless — the implicit return path defeats it, and one-way travel would only work between locations the tree never linked.

## Decision

An authored Connection between locations A and B — either direction, either arity — **removes the implicit link for that pair**. The Connection's own directions are all that remain. Pairs with no authored Connection keep full implicit navigation, so a world with no Connections plays exactly as before.

## Consequences

- One-way travel works everywhere, including between siblings and across a parent-child boundary.
- Authoring a Connection on an implicitly-linked pair *narrows* travel unless it is two-way — an editor surface (canvas) must make the replaced link visible or the author will strand players by accident.
- Enforcement is structural: the router only matches the model's reply against the effective candidate list, so no prompt text about direction is needed or wanted.

## Alternatives rejected

**Additive edges** (implicit always survives): simplest, but one-way becomes an inconsistent tool that silently fails on tree-adjacent pairs.

**Per-location "explicit edges only" flag**: maximum control, but a second concept to teach, and one flag flip strands every child of a location at once.
