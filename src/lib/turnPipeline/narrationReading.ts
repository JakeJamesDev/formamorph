import type { Entity, GameLocation, SceneEntity } from "@/types";
import type { DiscoveredEntity } from "@/types/gameplay";
import { findEntityNames, matchNames, matchNamesLoose, sameCharacterName, stripQuotedSpeech } from "../entityMatch";
import { extractCharacterCandidates, collectCandidateEvidence, type CandidateExclusions } from "../characterCandidates";
import { buildSceneList, type DirectorCastMember } from "../stagedPlanning";
import { selectReachableVisitors } from "../runtimeCharacters";
import type { TurnPassSubject } from "./turnPlan";

export interface NarrationReadingInput {
  narration: string;
  /** All past narration the player has read — the corpus for "has this name been revealed yet?". */
  priorNarration: string;
  entities: Entity[];
  /** Defined entities the planner cast: loose match, since it already vouched they're present. */
  directorCandidates: string[];
  /** Planner-invented names with no entity record: strict match. */
  adHocCandidates: string[];
  exclusions: CandidateExclusions;
  /** The planner's cast, which the live scene list is sourced from. Null when no planner ran (Off/Inline). */
  sceneCast: DirectorCastMember[] | null;
}

export interface NarrationReading {
  /** The narration with quoted speech removed — what presence is read from. */
  prose: string;
  /** Names the narrator invented this turn, matched against nothing but the page. */
  narratedNames: string[];
  /** Who took part: the entity tab, the choices filter, and stored participation all read this. */
  participants: string[];
  /** The authoritative scene list, ready for `setVisibleEntities`. */
  visibleEntities: SceneEntity[];
}

/**
 * What the narration confirms: who took part, and who is on screen.
 *
 * Presence comes from what the narration shows happening, not from who the dialogue talks about — a character
 * named only inside quotes ("for Professor Serana's review") was mentioned, not present. The planner-confirmation
 * sources read the full text: a cast is an authoritative presence signal, not an inference from the page.
 *
 * The narration-only extractor is the fourth source and is always on: on pure narration the other three are
 * blind to a character the narrator has just invented (the first matches known entities only, the other two
 * are populated by staged planning), so without it discovery required already having been discovered. It costs
 * no request — only the DESCRIPTION that turns a name into a full entity does, and that is what the setting
 * governs.
 */
export function readNarration(input: NarrationReadingInput): NarrationReading {
  const { narration, priorNarration, entities, directorCandidates, adHocCandidates, exclusions, sceneCast } = input;

  const prose = stripQuotedSpeech(narration);
  const narratedNames = extractCharacterCandidates(prose, exclusions, collectCandidateEvidence(priorNarration));
  const participants = [
    ...new Set([
      ...findEntityNames(prose, entities),
      ...matchNamesLoose(narration, directorCandidates),
      ...matchNames(narration, adHocCandidates),
      ...narratedNames,
    ]),
  ];

  // Presence is the planner's cast (so a merely-mentioned character never shows); a name reveals once it has
  // appeared in the narration. With no planner it falls back to the narration parse. Narration-only names join
  // too: buildSceneList resolves against KNOWN entities, so a character being discovered this very turn would
  // otherwise be missing from the panel until the next turn — the describe request lands moments later and the
  // row goes live in place.
  const sceneList = buildSceneList({ cast: sceneCast, entities, narrationSoFar: narration, priorNarration });
  const sceneNames = new Set(sceneList.map((se) => se.name.toLowerCase()));
  const visibleEntities = [
    ...sceneList,
    ...narratedNames.filter((name) => !sceneNames.has(name.toLowerCase())).map((name) => ({ name, revealed: true })),
  ];

  return { prose, narratedNames, participants, visibleEntities };
}

export interface VisitorInput {
  /** The narration prose — same corpus presence is read from. */
  prose: string;
  entities: Entity[];
  /** Every entity the turn can resolve against, authored plus discovered. */
  allEntities: Entity[];
  location: GameLocation;
  locations: GameLocation[];
  /** Entity ids already at the location, discovered ones included. */
  presentIds: string[];
  /** Already-anchored discoveries, so a visitor is never added twice. */
  discovered: DiscoveredEntity[];
  turnId: string;
}

/**
 * Bring-them-over: an authored character living in a reachable sibling that the narration named joins the
 * current location as a visitor, anchored via the discovered-entity path so it persists and rolls back with
 * the turn.
 *
 * Fed by a stricter parse than `participants`: this path physically relocates an authored NPC, so it takes
 * full-name hits only — a loose single-word match must not teleport someone into the scene. Prose-only for the
 * same reason presence is: `partial: false` bounds how loosely a name may match, not whether it was merely
 * spoken about, and a full name inside dialogue still hits. Once someone is anchored here they count as
 * present, so a dialogue-only mention would otherwise walk them into the scene permanently and past the
 * now-line's location filter.
 */
export function selectVisitorAdditions(input: VisitorInput): DiscoveredEntity[] {
  const { prose, entities, allEntities, location, locations, presentIds, discovered, turnId } = input;
  const visitorParticipants = findEntityNames(prose, allEntities, { partial: false });
  const visitors = selectReachableVisitors(visitorParticipants, location, locations, entities, presentIds);
  return visitors
    .filter((v) => !discovered.some((d) => d.locationId === location.id && sameCharacterName(d.entity.name, v.name)))
    .map((entity) => ({ entity, locationId: location.id, sourceTurnId: turnId }));
}

/**
 * Split this turn's participants between the two post-narration fan-outs. A participant the narration
 * introduced but no entity matches yet is discovered first; its diary needs that generated description, so
 * it is left to the drainer to write post-discovery.
 */
export function splitParticipants(
  participants: string[],
  entities: Entity[],
  suppressed: string[],
): { diary: TurnPassSubject[]; discoverEntity: TurnPassSubject[] } {
  const known = (name: string) => entities.some((e) => sameCharacterName(e.name, name));
  return {
    diary: participants
      .filter(known)
      .map((name) => ({ name, entity: entities.find((e) => sameCharacterName(e.name, name)) })),
    discoverEntity: participants
      .filter((name) => !known(name) && !suppressed.some((blocked) => sameCharacterName(name, blocked)))
      .map((name) => ({ name })),
  };
}

/**
 * Who the choices pass may act for: this turn's participants plus those from the prior turns in the rolling
 * window, scoped to entities that exist. Empty → the choices request gets no entity section, so it cannot
 * spoil or act for anyone not present.
 */
export function presentSceneEntities(
  entities: Entity[],
  participants: string[],
  recent: string[],
): Entity[] {
  const presentNames = new Set([...participants, ...recent]);
  return entities.filter((e) => presentNames.has(e.name));
}
