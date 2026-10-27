# 02: Server Thread Numbers

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q7, Q13); server spec: Thread number

Repo: FormamorphServer.

## What to build

Every feedback thread has a short number from one sequence shared by bugs, suggestions and questions. Existing threads are numbered in creation order. Every thread DTO returns `number`, and a thread read accepts a number as well as the UUID.

## Acceptance criteria

- [ ] A schema step adds a unique, non-null `number` and backfills existing rows in creation order, ties broken by id. The boot-schema drift test passes.
- [ ] A new thread of any type takes the next number, inside the insert's transaction.
- [ ] List and thread DTOs return `number`.
- [ ] A thread read by number returns the same thread as by UUID, with the same read rules.
