// Old names for ./owners, kept while call sites move over.

// Re-exports, not `export *` or a const copy: those read the value when this module loads, which misses a
// name that a module cycle has not defined yet.
export {
  broughtIds, canBePlayer, editorGateInput, heldReason, holdsOriginal, inCast, linksInTreeOrder, makeLink, originalOf, playsAs,
  withoutSelfNamedGates, ownsOrLinksTraits as bearsTraits, resolveOwners as resolveBearers,
} from './owners';
export type { Owner as Bearer, OwnerResolution as BearerResolution, OwnerWorld as BearerWorld } from './owners';
export { PLAYER_OWNER as PLAYER_BEARER } from './traitGates';
