# Formamorph

Browser AI text-RPG: authored worlds played through an AI narrator against any OpenAI-compatible endpoint. Glossary of project-specific terms; keep implementation details out.

## Language

**AI Stream**:
The module that turns one AI request spec into a typed async event stream (delta / reasoning / debug / done) over SSE, absorbing all endpoint protocol quirks.
_Avoid_: fetch helper, completion client

**AI Request Spec**:
The complete, plain-value description of one AI call — prompt, messages, resolved endpoint, sampler, reasoning preferences — built from a settings snapshot; everything the AI Stream needs, nothing live.
_Avoid_: request options, config

**Entity**:
Any world inhabitant the narrator can reference — person, creature, plant, or object.
_Avoid_: character (too narrow)

**Turn Pipeline**:
The module that runs one full turn — plan, AI requests, commit computation — behind one seam; React state stays outside it.
_Avoid_: turn handler, game loop

**Turn Plan**:
The pure, plain-value output of planning a turn: which passes run, with what prompts and token caps.
_Avoid_: turn config

**Turn Commit**:
The computed state delta a finished turn applies — history, clock, stats, discoveries.
_Avoid_: turn state, commit object
