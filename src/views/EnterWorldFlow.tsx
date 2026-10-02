import { randomUUID } from '@/lib/uuid';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { usePlaceholderSession } from '@/contexts/PlaceholderSessionContext';
import { useLingeringMount } from '@/lib/useLingeringMount';
import { useMountedRef } from '@/lib/useMountedRef';
import { useResolvedAuthoredWorld } from '@/lib/useResolvedWorld';
import { inAuthoredOrder, traitOrderIndex } from '@/lib/traitEffects';
import { bearerPins, inPlayBearers, playedEntityId } from '@/lib/ownedTraitsInPlay';
import { startingStatsWith } from '@/lib/traitRuntime';
import { toastError } from '@/lib/linkToast';
import CharacterCustomization, { defaultCharacterData } from './CharacterCustomization';
import EnterWorldWorkspace from './EnterWorldWorkspace';
import { startingLocations } from '@/lib/startingLocation';
import {
  WORLD_OWNER, gateStates, settle, shownRefs, switchTrait, type SettleResult,
} from '@/lib/traitGates';
import type { TraitCascade } from '@/components/game/SetupTraitList';
import { buildInitialSelection, finalizeSelection, shouldShowDictionaryChoices } from '@/lib/dictionarySelection';
import { libraryLines } from '@/lib/librarySources';
import { followedLibraryId } from '@/lib/publishLinks';
import {
  castOwnedTraits, emptyEntryDraft, entryDefaults, entryGateInput, entryOwners, libraryCastIds, rekeyOwnedPicks,
  withLibraryDefaults, withLocationPick, withPersonaPick, withSettledTraits, type EntryDraft, type EntryTraitWorld,
} from '@/lib/entryDraft';
import { bindLibraryEntity, blueprintBindWorld } from '@/lib/blueprintTravel';
import { hasWorldAdditionDefaults, restoreWorldAdditionDefaults, saveWorldAdditionDefaults } from '@/lib/worldAdditionDefaults';
import {
  hasPersonaChoice, namedStartLocation, offeredPersonas, offeredStartLocations, preselectPersona, readWorldPersona,
  rememberWorldPersona, withoutPersona, worldPersonaRules, type PersonaPickContext,
} from '@/lib/personaPick';
import { personaOption, withPersonaEntry } from '@/lib/persona';
import type { PersonaPick } from '@/lib/persona';
import { customPersonaEntity } from '@/lib/blueprints';
import type { PersonaOption } from '@/components/game/PersonaPicker';
import DictionaryStorageService from '../services/DictionaryStorageService';
import EntityStorageService from '../services/EntityStorageService';
import { LibraryRecordNotFoundError } from '../services/LibraryStore';
import type { WorldRecord } from '@/components/WorldDetails';
import ReadmeModal from '@/components/game/ReadmeModal';
import { buildEnterFlow, navigableSteps, type EnterMode, type EnterStep, type NavigableStep } from '@/lib/enterFlow';
import type {
  CharacterData, Dictionary, DictionaryMetadata, Entity, EntityMetadata, OwnedTraitPicks, PersonaRef,
} from '@/types';

export type StartGame = (
  traits: string[], characterData: CharacterData | null, isNewGame?: boolean, startingLocationId?: string | null,
  dictionaries?: Dictionary[] | null, characters?: Entity[] | null, persona?: PersonaPick, ownedTraits?: OwnedTraitPicks,
) => void;

export interface EnterWorldFlowHandle {
  /** Opens the first entry step for the selected world, on its remembered and default choices. */
  start: () => void;
  /** Starts the selected world on its authored defaults, past every setup step. */
  quickStart: () => void;
}

interface EnterWorldFlowProps {
  world: WorldRecord | null;
  /** The local entity and dictionary libraries, as metadata. */
  libraryEntities: EntityMetadata[];
  libraryDictionaries: DictionaryMetadata[];
  signedInId: string | undefined;
  /** The global default persona: a library entity id. */
  defaultPersona: string | undefined;
  showReadme: (worldId: string) => boolean;
  setShowReadme: (worldId: string, show: boolean) => void;
  /** Held by the menu, which gives the whole screen to the Avatar step while the Introduction is closed. */
  introOpen: boolean;
  setIntroOpen: (open: boolean) => void;
  avatarOpen: boolean;
  setAvatarOpen: (open: boolean) => void;
  onStartGame: StartGame;
}

/**
 * Enter World, from the first setup step to the game's start. It owns the visit's draft, so a pick in
 * the setup dialog renders this flow and not the menu behind it.
 */
const EnterWorldFlow = forwardRef<EnterWorldFlowHandle, EnterWorldFlowProps>(function EnterWorldFlow({
  world: selectedWorld, libraryEntities: entities, libraryDictionaries: dictionaries, signedInId, defaultPersona,
  showReadme, setShowReadme, introOpen: showIntroReadme, setIntroOpen: setShowIntroReadme,
  avatarOpen: showCharacterCustomization, setAvatarOpen: setShowCharacterCustomization, onStartGame,
}, ref) {
  const isMountedRef = useMountedRef();
  const {
    traits: rawTraits, traitGroups: rawTraitGroups, stats: rawStats, locations: rawLocations, placeholders,
    dictionaries: worldBooks, entities: worldEntities, worldPlaceholders, placeholderGroups,
  } = useGameData();
  const { beginSession, endSession, rolls } = usePlaceholderSession();

  const [showSetupWorkspace, setShowSetupWorkspace] = useState(false);
  // The workspace stays mounted for one exit animation after it closes, so the dialog can fade out.
  const workspaceMounted = useLingeringMount(showSetupWorkspace, 250);
  // Set only when the Introduction has no setup screen to sit over: the traits to start with once the
  // player closes it. A world with nothing to choose would otherwise flash the overlay and enter anyway.
  const [enterAfterIntro, setEnterAfterIntro] = useState<EntryDraft | null>(null);
  const [entryDraft, setEntryDraft] = useState<EntryDraft>(emptyEntryDraft);
  const {
    traitIds: selectedTraits, ownedTraitIds: ownedTraitPicks, persona: draftPersona, locationId: selectedLocationId,
  } = entryDraft;
  const [resolvingEntry, setResolvingEntry] = useState(false);
  const entryRequest = useRef<object | null>(null);
  const entryStarted = useRef(false);
  const cancelEntryResolution = () => {
    entryRequest.current = null;
    setResolvingEntry(false);
  };
  const updateDraft = <K extends keyof EntryDraft>(key: K, value: React.SetStateAction<EntryDraft[K]>) => {
    cancelEntryResolution();
    setEntryDraft(prev => ({ ...prev, [key]: typeof value === 'function' ? value(prev[key]) : value }));
  };
  const reviseDraft = (revise: (draft: EntryDraft) => EntryDraft) => {
    cancelEntryResolution();
    setEntryDraft(revise);
  };
  useEffect(() => () => { entryRequest.current = null; }, []);
  // Finalized dictionaries for normal entry; null keeps Quick Start and saves on authored defaults.
  const [selectedDictionaries, setSelectedDictionaries] = useState<Dictionary[] | null>(null);
  // Independent entity copies finalized for normal entry; null means this path did not configure entities.
  const [selectedCharacters, setSelectedCharacters] = useState<Entity[] | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<PersonaPick>({ ref: { source: 'none' } });
  // The cast's owned picks as the game starts with them, keyed by the added characters' copy ids.
  const [selectedCastPicks, setSelectedCastPicks] = useState<OwnedTraitPicks>({});

  // The raw world's traits, whose names carried requirements were stored under and bind to, and its blueprints.
  const rawTraitWorld = useMemo(
    () => ({
      traits: rawTraits, traitGroups: rawTraitGroups, entities: worldEntities,
      ...blueprintBindWorld({ placeholders: worldPlaceholders, placeholderGroups }),
    }),
    [rawTraits, rawTraitGroups, worldEntities, worldPlaceholders, placeholderGroups],
  );
  // The library entities in the cast, loaded in full on pick so their owned traits join the tree.
  const [libraryCastData, setLibraryCastData] = useState<ReadonlyMap<string, Entity>>(() => new Map());
  const castIds = libraryCastIds(entryDraft);
  const castKey = castIds.join('|');
  useEffect(() => {
    const missing = castKey.split('|').filter((id) => id && !libraryCastData.has(id));
    if (!missing.length) return;
    let cancelled = false;
    void Promise.all(missing.map((id) => EntityStorageService.getEntityData(id).catch(() => null))).then((loaded) => {
      if (cancelled || !isMountedRef.current) return;
      setLibraryCastData((prev) => new Map([...prev, ...loaded.flatMap((e) => (e ? [[e.id, e] as const] : []))]));
    });
    return () => { cancelled = true; };
  }, [castKey, libraryCastData, isMountedRef]);
  const libraryCast = useMemo(
    () => castKey.split('|').flatMap((id) => libraryCastData.get(id) ?? [])
      .map((e) => bindLibraryEntity(e, rawTraitWorld)),
    [castKey, libraryCastData, rawTraitWorld],
  );
  // The pins the *draft* selection would impose: the traits ticked so far, the starting location picked, and
  // the bands the starting stats fall in once those traits have applied — so these screens resolve the way
  // the game will open, and a pinned name changes the moment its source is picked. Pins mask the roll
  // rather than replacing it, so unticking the trait brings the rolled value back.
  const draftPins = useMemo(() => {
    const chosen = inAuthoredOrder(
      rawTraits.filter((t) => selectedTraits.includes(t.id)), traitOrderIndex(rawTraits, rawTraitGroups),
    );
    const world = { traits: rawTraits, traitGroups: rawTraitGroups, entities: worldEntities };
    // The persona's linked stat traits apply after the world picks, as the game's seed does.
    const starting = startingStatsWith(rawStats, chosen, {
      traits: rawTraits, groups: rawTraitGroups, entities: worldEntities, persona: draftPersona,
      bearers: inPlayBearers(world, draftPersona, libraryCast),
    }, ownedTraitPicks);
    return bearerPins({
      world,
      persona: draftPersona,
      library: libraryCast,
      playerTraits: chosen,
      owned: ownedTraitPicks,
      sharedPlaceholders: worldPlaceholders,
    }, {
      location: rawLocations.find((l) => l.id === selectedLocationId),
      stats: starting,
      placeholders,
      rolls,
    });
  }, [
    selectedTraits, ownedTraitPicks, draftPersona, selectedLocationId, rawTraits, rawTraitGroups, worldEntities,
    worldPlaceholders, rawStats, rawLocations, placeholders, rolls, libraryCast,
  ]);
  const {
    traits, traitGroups, locations, entities: resolvedWorldEntities, resolvePH, resolveTraitText, resolveEntityText,
  } = useResolvedAuthoredWorld(draftPins);

  // The starting selection's gates, and the banner naming what the last change turned off.
  const [traitCascade, setTraitCascade] = useState<TraitCascade | null>(null);
  // Every bearer in the cast: the player, the world's entities, and the library entities.
  const entryWorld = useMemo<EntryTraitWorld>(
    () => ({ traits, traitGroups, entities: resolvedWorldEntities, library: libraryCast }),
    [traits, traitGroups, resolvedWorldEntities, libraryCast],
  );
  const rawEntryWorld: EntryTraitWorld = {
    traits: rawTraits, traitGroups: rawTraitGroups, entities: worldEntities, library: libraryCast,
  };
  // A library entity that joins the cast starts on its own defaults.
  useEffect(() => {
    setEntryDraft((draft) => withLibraryDefaults(draft, entryWorld));
  }, [entryWorld]);
  const castOwners = useMemo(() => entryOwners(entryWorld, entryDraft.persona), [entryWorld, entryDraft.persona]);
  const traitGates = useMemo(() => gateStates(entryGateInput(entryWorld, entryDraft)), [entryWorld, entryDraft]);
  // A cast entity's trait carries its bearer's name; the player's own, and the played persona's, read bare.
  const traitName = (ownerId: string, traitId: string) => {
    const owner = castOwners.find((o) => o.id === ownerId);
    const name = owner?.traits.find((t) => t.id === traitId)?.name ?? traitId;
    return owner && ownerId !== WORLD_OWNER && ownerId !== playedEntityId(entryDraft.persona) ? `${owner.name}'s ${name}` : name;
  };
  // Every bearer's picks by owner id, the player's under the world's.
  const entrySelectedTraits = useMemo(
    () => ({ ...entryDraft.ownedTraitIds, [WORLD_OWNER]: entryDraft.traitIds }),
    [entryDraft.traitIds, entryDraft.ownedTraitIds],
  );
  const cascadeFrom = (result: SettleResult, because: string): TraitCascade | null => {
    const names = shownRefs(castOwners, result.turnedOff).map((ref) => traitName(ref.ownerId, ref.traitId));
    return names.length ? { off: names, because } : null;
  };

  // Toggle a bearer's trait in the starting selection; a cascade shows in the banner.
  const handleTraitSelection = (traitId: string, ownerId: string) => {
    const result = switchTrait(entryGateInput(entryWorld, entryDraft), ownerId, traitId, entryDraft.cascadeOffTraitIds);
    if (!result) return;
    reviseDraft((draft) => withSettledTraits(draft, result));
    setTraitCascade(cascadeFrom(result, traitName(ownerId, traitId)));
  };

  // A persona pick can open or close "playing as" gates, so the traits settle against the new persona.
  const handlePersonaChange = (ref: PersonaRef) => {
    const next = withPersonaPick(entryDraft, ref, personaPickContext);
    // A pick the last persona turned off returns once the new one opens its gate again.
    const result = settle(entryGateInput(entryWorld, next), next.cascadeOffTraitIds);
    reviseDraft(() => withSettledTraits(next, result));
    const picked = ref.source === 'world' ? worldPersonaOptions.find((p) => p.id === ref.entityId)
      : ref.source === 'library' ? personaOptions.find((p) => p.id === ref.entityId) : undefined;
    setTraitCascade(cascadeFrom(result, picked?.name ?? 'the persona change'));
  };

  /**
   * The library characters this world does not already hold a copy of, each with its author and source
   * lines. Offering one the world already holds would put the same character in the run twice.
   *
   * A hidden character gets no Linked row the way a hidden dictionary does. The step lists dictionaries
   * from both the world and the library, so a world dictionary has a row to mark; the world's own
   * characters are always in play and were never rows here.
   */
  const additionEntities = useMemo(() => {
    const followed = new Set(worldEntities
      .map(followedLibraryId)
      .filter((id): id is string => !!id));
    return entities
      .filter((meta) => !followed.has(meta.id))
      .map((meta) => ({ ...meta, ...libraryLines(meta, signedInId) }));
  }, [entities, signedInId, worldEntities]);

  /** The library personas this entry offers: marked entities the world holds no copy of. */
  const personaOptions = useMemo(
    () => additionEntities.filter((entity) => entity.persona === true).map(({ id, name, image, description }) => ({ id, name, image, description })),
    [additionEntities],
  );
  /** The world's entities the author marked as playable. */
  const worldPersonaOptions = useMemo<PersonaOption[]>(
    () => resolvedWorldEntities.filter((entity) => entity.persona === true)
      .map((entity) => ({ ...personaOption(resolveEntityText)(entity), startsAt: namedStartLocation(entity, locations)?.name })),
    [resolvedWorldEntities, resolveEntityText, locations],
  );
  /** The Custom Persona entity, which stands in None's place. */
  const customPersonaOption = useMemo<PersonaOption | undefined>(() => {
    const marked = customPersonaEntity(resolvedWorldEntities);
    return marked && personaOption(resolveEntityText)(marked);
  }, [resolvedWorldEntities, resolveEntityText]);
  /** The entities the trait tree pages, the marked one carrying the player's entry or library persona. */
  const entryPersona = entryDraft.persona;
  const entryLibraryName = entryPersona?.source === 'library'
    ? personaOptions.find((p) => p.id === entryPersona.entityId)?.name : undefined;
  const entryTraitEntities = useMemo(
    () => withPersonaEntry(entryWorld.entities, entryDraft.persona, entryLibraryName),
    [entryWorld.entities, entryDraft.persona, entryLibraryName],
  );
  const personaRules = worldPersonaRules(selectedWorld?.data.worldOverview);
  /** What the step's Persona category lists under the world's Allowed Personas. */
  const personaOffer = useMemo(
    () => offeredPersonas(personaRules.allowed, { world: worldPersonaOptions, library: personaOptions, custom: customPersonaOption }),
    [personaRules.allowed, worldPersonaOptions, personaOptions, customPersonaOption],
  );
  const personaPickContext: PersonaPickContext = {
    worldEntities: resolvedWorldEntities,
    locations,
  };
  // Enter World and Quick Start start on the same persona, and at the same location for it.
  const personaPreselect = (worldId: string) => preselectPersona({
    rules: personaRules,
    remembered: readWorldPersona(worldId),
    globalDefault: defaultPersona,
    available: {
      world: worldPersonaOptions.map((option) => option.id),
      library: personaOptions.map((option) => option.id),
      custom: !!customPersonaOption,
    },
  });
  // Reads a library persona for page one. One deleted since the pick lands as None.
  const loadPersonaPick = async (ref: PersonaRef): Promise<PersonaPick> => {
    if (ref.source !== 'library') return { ref };
    try {
      return { ref, libraryEntity: await EntityStorageService.getEntityData(ref.entityId) };
    } catch (error) {
      if (error instanceof LibraryRecordNotFoundError) return { ref: { source: 'none' } };
      throw error;
    }
  };

  const hasLibraryAdditions = additionEntities.length > 0 || shouldShowDictionaryChoices(worldBooks, dictionaries)
    || (worldBooks.length > 0 && !!selectedWorld && hasWorldAdditionDefaults(selectedWorld.id));

  // Resolve one snapshot; navigation or cancellation invalidates its pending handoff.
  const enterWorld = async (draft: EntryDraft = entryDraft) => {
    if (entryRequest.current || entryStarted.current) return;
    const request = {};
    entryRequest.current = request;
    setResolvingEntry(true);
    try {
      const characterIds = withoutPersona(draft.entityIds, draft.persona);
      const loaded = await Promise.all(additionEntities.filter(m => characterIds.has(m.id))
        .map(async (metadata) => {
          try {
            return await EntityStorageService.getEntityData(metadata.id);
          } catch (error) {
            if (error instanceof LibraryRecordNotFoundError) return null;
            throw error;
          }
        }));
      // Each copy gets its own id, its owned traits and copies bound to the world, and the picks made under its library id.
      const copyIds = new Map<string, string>();
      const chars = loaded.filter((e): e is Entity => e !== null).map((e) => {
        const id = randomUUID();
        copyIds.set(e.id, id);
        return bindLibraryEntity({ ...e, id }, rawTraitWorld);
      });
      const castPicks = rekeyOwnedPicks(castOwnedTraits(draft, entryWorld), copyIds);
      const books = new Map<string, Dictionary>();
      for (const item of draft.dictionaryItems) {
        if (item.enabled && item.source === 'library') {
          try {
            books.set(item.book.id, await DictionaryStorageService.getDictionaryData(item.book.id));
          } catch (error) {
            if (!(error instanceof LibraryRecordNotFoundError)) throw error;
          }
        }
      }
      const persona = await loadPersonaPick(draft.persona);
      if (entryRequest.current !== request) return;
      const dicts = finalizeSelection(draft.dictionaryItems, books);
      // Only a pick the step showed is remembered; a hidden category leaves room for a later default.
      if (hasPersonaChoice(personaOffer)) rememberWorldPersona(selectedWorld!.id, draft.persona);
      setSelectedCharacters(chars);
      setSelectedCastPicks(castPicks);
      setSelectedDictionaries(dicts);
      setSelectedPersona(persona);
      if (selectedWorld!.data.worldOverview?.use3DModel) {
        showEnterStep('avatar');
      } else {
        entryStarted.current = true;
        onStartGame(draft.traitIds, null, true, draft.locationId, dicts, chars, persona, castPicks);
      }
    } catch (error) {
      if (entryRequest.current === request) {
        entryStarted.current = false;
        console.error('Could not finalize enter-world library additions', error);
        toastError(error, { headline: 'Formamorph could not prepare those library additions. Try again.' });
      }
    } finally {
      if (entryRequest.current === request) cancelEntryResolution();
    }
  };

  const advanceEntry = (step: NavigableStep) => {
    const steps = navigableSteps(enterFlowSteps());
    const next = steps[steps.indexOf(step) + 1];
    if (next && next !== 'avatar') showEnterStep(next);
    else void enterWorld();
  };

  const abandonEnterFlow = () => {
    cancelEntryResolution();
    setEntryDraft(emptyEntryDraft());
    setSelectedCharacters(null);
    setSelectedDictionaries(null);
    setSelectedPersona({ ref: { source: 'none' } });
    setShowIntroReadme(false);
    setEnterAfterIntro(null);
    setShowSetupWorkspace(false);
    setShowCharacterCustomization(false);
    endSession();
  };

  // The enter-world steps actually shown for this world + library, in flow order — drives the Back button
  // and the Introduction overlay (see `lib/enterFlow`).
  const enterFlowSteps = (mode: EnterMode = 'newGame'): EnterStep[] => buildEnterFlow({
    introReadme: selectedWorld?.data.worldOverview?.introReadme,
    traitCount: castOwners.reduce((count, owner) => count + owner.traits.length, 0),
    startingLocationCount: startingLocations(locations).length,
    hasLibraryAdditions,
    hasWorldPersonas: worldPersonaOptions.length > 0,
    use3DModel: !!selectedWorld?.data.worldOverview?.use3DModel,
  }, mode);
  const showEnterStep = (step: NavigableStep) => {
    cancelEntryResolution();
    setShowSetupWorkspace(step === 'workspace');
    setShowCharacterCustomization(step === 'avatar');
  };
  // Back handler for a given step: goes to the previous shown step, or undefined on the first (button fades).
  const backFrom = (step: NavigableStep): (() => void) | undefined => {
    const steps = navigableSteps(enterFlowSteps());
    const idx = steps.indexOf(step);
    return idx > 0 ? () => showEnterStep(steps[idx - 1]) : undefined;
  };

  const openFirstEnterStep = (steps: NavigableStep[], draft: EntryDraft) => {
    if (steps[0] && steps[0] !== 'avatar') showEnterStep(steps[0]);
    else void enterWorld(draft);
  };

  const closeIntroReadme = () => {
    setShowIntroReadme(false);
    if (!enterAfterIntro) return;
    const draft = enterAfterIntro;
    setEnterAfterIntro(null);
    void enterWorld(draft);
  };

  const start = () => {
    const additions = restoreWorldAdditionDefaults(
      selectedWorld!.id, buildInitialSelection(worldBooks, dictionaries, signedInId), additionEntities);
    const persona = personaPreselect(selectedWorld!.id);
    // The persona wins a tie with a remembered character, and a world persona preselects its location.
    const draft = withPersonaPick(
      // Library entities join with their own defaults once loaded, so the last visit's cast starts no picks.
      { ...emptyEntryDraft(), ...entryDefaults({ ...rawEntryWorld, library: [] }, persona), ...additions }, persona, personaPickContext);
    cancelEntryResolution();
    setLibraryCastData(new Map());
    entryStarted.current = false;
    setEntryDraft(draft);
    setTraitCascade(null);
    beginSession();
    const steps = enterFlowSteps();
    const rest = navigableSteps(steps);
    if (steps[0] === 'intro' && showReadme(selectedWorld!.id)) {
      setShowIntroReadme(true);
      if (rest.length === 0) {
        setEnterAfterIntro(draft);
        return;
      }
    }
    openFirstEnterStep(rest, draft);
  };

  const quickStart = () => {
    // For uploaded worlds, use the worldData from context
    const currentWorldData = selectedWorld!.data;
    // Skip the setup steps but honor the author's default trait choices.
    const persona = personaPreselect(selectedWorld!.id);
    // A world persona starts at its own starting location; any other start stays random.
    const draft = withPersonaPick({
      ...emptyEntryDraft(), ...entryDefaults({ ...rawEntryWorld, library: [] }, persona),
      dictionaryItems: buildInitialSelection(worldBooks, dictionaries, signedInId),
    }, persona, personaPickContext);
    if (entryStarted.current) return;
    cancelEntryResolution();
    entryStarted.current = true;
    setEntryDraft(draft);
    const characterData = currentWorldData.worldOverview?.use3DModel ? defaultCharacterData : null;
    loadPersonaPick(persona).then(
      (pick) => {
        // A library persona starts on its own owned defaults.
        const cast: EntryTraitWorld = {
          ...rawEntryWorld,
          library: pick.libraryEntity
            ? [bindLibraryEntity(pick.libraryEntity, rawTraitWorld)]
            : [],
        };
        onStartGame(
          draft.traitIds, characterData, true, draft.locationId, null, null, pick,
          castOwnedTraits(withLibraryDefaults(draft, cast), cast),
        );
      },
      (error: unknown) => {
        entryStarted.current = false;
        console.error('Could not read the Quick Start persona', error);
        toastError(error, { headline: 'Formamorph could not read that persona. Try again.' });
      },
    );
  };

  useImperativeHandle(ref, () => ({ start, quickStart }));

  if (showCharacterCustomization && !showIntroReadme) {
    return (
      <CharacterCustomization
        onCharacterCustomized={(customizedData) => {
          if (entryStarted.current) return;
          entryStarted.current = true;
          setShowCharacterCustomization(false);
          onStartGame(
            selectedTraits, customizedData, true, selectedLocationId, selectedDictionaries, selectedCharacters, selectedPersona,
            selectedCastPicks,
          );
        }}
        onBack={backFrom('avatar')}
        onAbort={() => {
          setShowCharacterCustomization(false);
          abandonEnterFlow();
        }}
      />
    );
  }

  return (
    <>
      {/* The world's Introduction, over whichever setup screen is behind it. Placeholders resolve because
          `beginSession` rolls them on the Enter World click, before this opens. */}
      {selectedWorld && (
        <ReadmeModal
          title="Introduction"
          readme={resolvePH(selectedWorld.data.worldOverview?.introReadme ?? '')}
          open={showIntroReadme}
          onOpenChange={(open) => { if (!open) closeIntroReadme(); }}
          show={showReadme(selectedWorld.id)}
          onShowChange={(s) => setShowReadme(selectedWorld.id, s)}
        />
      )}

      {workspaceMounted && selectedWorld && (
        <EnterWorldWorkspace
          open={showSetupWorkspace}
          worldName={selectedWorld.name}
          traits={traits}
          traitGroups={traitGroups}
          traitEntities={entryTraitEntities}
          traitLibrary={entryWorld.library}
          resolveEntityText={resolveEntityText}
          stats={rawStats}
          locations={offeredStartLocations(entryDraft.persona, personaPickContext)}
          resolveText={resolvePH}
          resolveTraitText={resolveTraitText}
          selectedTraits={entrySelectedTraits}
          selectedLocationId={selectedLocationId}
          worldAuthor={selectedWorld?.author}
          libraryEntities={additionEntities}
          selectedEntityIds={entryDraft.entityIds}
          dictionaryItems={entryDraft.dictionaryItems}
          worldPersonas={personaOffer.world}
          personas={personaOffer.library}
          personaNone={personaOffer.none}
          personaCustom={personaOffer.custom}
          persona={entryDraft.persona}
          onPersonaChange={handlePersonaChange}
          categoryIndex={entryDraft.traitSection}
          onCategoryChange={(index) => updateDraft('traitSection', index)}
          onTraitSelect={handleTraitSelection}
          traitGates={traitGates}
          traitCascade={traitCascade}
          onDismissTraitCascade={() => setTraitCascade(null)}
          onLocationChange={(id) => reviseDraft((draft) => withLocationPick(draft, id))}
          onEntityToggle={(id, selected) => updateDraft('entityIds', (current) => {
            const next = new Set(current);
            if (selected) next.add(id); else next.delete(id);
            return next;
          })}
          onDictionaryItemsChange={(items) => updateDraft('dictionaryItems', items)}
          onSaveAdditions={() => {
            try {
              saveWorldAdditionDefaults(selectedWorld.id, entryDraft);
              return true;
            } catch (error) {
              toastError(error, { headline: 'Formamorph could not save these additions. Try again.' });
              return false;
            }
          }}
          onIntroduction={selectedWorld.data.worldOverview?.introReadme?.trim()
            ? () => setShowIntroReadme(true)
            : undefined}
          onCancel={abandonEnterFlow}
          onContinue={() => advanceEntry('workspace')}
          continueLabel={selectedWorld.data.worldOverview?.use3DModel ? 'Continue to Avatar' : 'Start game'}
          resolving={resolvingEntry}
        />
      )}
    </>
  );
});

export default EnterWorldFlow;
