// A source scan, since the game view is too large to mount; GameplayContext.persona.test.tsx proves the cast.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/** The entity names a destructure of `hook()` takes, or [] when the file has none. */
const destructuredFrom = (source: string, hook: string): string[] =>
  [...source.matchAll(new RegExp(`const\\s*\\{([^}]*)\\}\\s*=\\s*${hook}\\(`, 'g'))]
    .flatMap((m) => m[1].split(','))
    .map((part) => part.trim())
    .filter((part) => /^entities\b/.test(part));

describe('entity readers in play', () => {
  const viewer = read('src/views/GameViewer.tsx');
  const panels = read('src/components/game/GamePanels.tsx');
  const liveScene = read('src/lib/chipValues/liveScene.ts');

  it('builds the game view cast from the resolved world, plus the discovered characters that are in play', () => {
    expect(destructuredFrom(viewer, 'useResolvedWorld')).toEqual(['entities']);
    expect(viewer).toMatch(/const discoveredInPlay = useMemo\(\(\) => inPlay\.discoveredOn\(discoveredEntities\)/);
    expect(viewer).toMatch(/const allEntities = useMemo\(\s*\(\) => \[\.\.\.entities, \.\.\.discoveredAsEntities\(discoveredInPlay\)\]/);
  });

  // One row per reader the spec names. Each pattern pins the list the reader is handed to a cast name.
  const readers: Array<{ reader: string; source: string; pattern: RegExp }> = [
    // The roster chips read the live Chip Scene: Here and In Scene from the full cast, the outer scopes from
    // the authored cast. liveScene.test.ts proves the rendering; this pins which list the scene is handed.
    { reader: 'roster chip', source: liveScene, pattern: /entities: allEntities,/ },
    { reader: 'roster chip, sublocations and reachable', source: liveScene, pattern: /outerScopeEntities: ownText\(underBox\(sources\.entities\)\),/ },
    // A before box hands the scene its own cast and the labels read from it; the live labels read the same way.
    { reader: 'before box cast', source: viewer, pattern: /const boxCast = entitiesFor\(overPins\);[\s\S]*?entities: boxCast,\s*strangerLabels: strangerLabelsOf\(boxCast\),/ },
    { reader: 'live stranger labels', source: viewer, pattern: /const strangerLabels = useMemo\(\(\) => strangerLabelsOf\(entities\),/ },
    { reader: 'roster chip, live view hands the adapter both casts', source: viewer, pattern: /entities,\s*allEntities,\s*standings: liveStandings,\s*participants,/ },
    { reader: 'prose parse for participation', source: viewer, pattern: /readNarration\(\{[^}]*entities: allEntities,/ },
    { reader: 'participation fan-out', source: viewer, pattern: /splitParticipants\(turnParticipants, liveScene\(null, codeView\)\.entities,/ },
    { reader: 'diaries, view hands over the cast', source: viewer, pattern: /const found = findEntityByCharacterName\(target\.name, allEntities\);/ },
    { reader: 'diaries, text resolved with its owner', source: viewer, pattern: /entity: found && resolveEntityTexts\(\[found\], resolveEntityText\)\[0\]/ },
    { reader: 'discovery matching', source: viewer, pattern: /entityNames: allEntities\.map\(\(e\) => e\.name\),/ },
    { reader: 'discovery exclusions', source: viewer, pattern: /characters: clean\(\[\.\.\.allEntities\.map\(\(e\) => e\.name\), \.\.\.playerNames\]\)/ },
    // The persona joins the picture by its own slot, never through the cast.
    { reader: 'scene tags', source: viewer, pattern: /pickSceneCast\(\{ participants, entities: allEntities, persona: persona\?\.entity \?\? null,/ },
    { reader: "planner's cast", source: viewer, pattern: /classifyCast\(cast, allEntities, playerNames\)/ },
    { reader: 'in-game entity panel', source: viewer, pattern: /entities=\{allEntities\}/ },
    // The seed resolves the pick itself, so it reads every world entity: a picked persona-only one is in no cast yet.
    // It reads them where the new game placed them.
    { reader: 'opening pool, new game', source: viewer, pattern: /drawNewGameOpening\(\{\s*pick: personaPick, worldEntities: traitEntities, placesOf: positionsIn\(startBook\),/ },
    { reader: 'opening pool, regenerate and load', source: viewer, pattern: /const sessionPool = \(\) => \{[^}]*openingPool\(\{\s*overview: worldOverview,\s*entities,/ },
    // The redraw reads where the cast stood when the game opened, never where it stands now (Q24).
    { reader: 'opening pool, the placement it reads', source: viewer, pattern: /placesOf: openingPlacesOf\(openingPlacement, entities,/ },
    { reader: 'panels, scene list', source: panels, pattern: /const \{ entities: authoredEntities(?:, \w+)* \} = useResolvedWorld\(\)/ },
    { reader: 'narration edit rescan', source: viewer, pattern: /useNarrationRescan\(\{ entities: allEntities,/ },
    // The agreement test calls each of these; the scan pins the game view to the call.
    { reader: 'present ids', source: viewer, pattern: /presentEntityIds\(allEntities, liveStandings, loc\?\.id\)/ },
    { reader: 'scene roster override', source: viewer, pattern: /sceneRosterValues\(liveScene\(sceneLoc\), sceneLoc, sceneEntities\)/ },
    { reader: 'Inventory pass owners', source: viewer, pattern: /inventoryOwnersIn\(liveScene\(location, null\), location, discovered, standings\)/ },
  ];

  // Readers of the authored world slice and of the runtime characters: each is handed the gated list.
  const testBench = read('src/lib/testBench/useTestBench.ts');
  const gated: Array<{ reader: string; source: string; pattern: RegExp }> = [
    { reader: 'Formaquestion Player View', source: viewer, pattern: /buildPlayerView\(\{\s*world: getInPlayWorldData\(\)[^}]*isEntityOn: inPlay\.isEntityOn/ },
    { reader: 'Formaquestion authored world', source: viewer, pattern: /playerViewWorld\(getInPlayWorldData\(\), playerViewReach\(\)\)/ },
    { reader: "Tool script's standalone state", source: viewer, pattern: /toolScriptSourceRef\.current = \(base\) => \{\s*const world = getInPlayWorldData\(\);/ },
    { reader: 'script entities, runtime characters', source: viewer, pattern: /discovered: laterDiscovered\(discoveredInPlay\)/ },
    { reader: 'script and pin entities, authored', source: read('src/lib/useResolvedWorld.ts'), pattern: /codeEntities = useMemo\(\(\) => \(\{ world: inPlay\.entities, library: libraryOn \}\)/ },
    { reader: 'placeholder pins in view', source: read('src/lib/usePlaceholderResolver.ts'), pattern: /world: \{ traits, traitGroups, entities: inPlay\.entities \}/ },
    { reader: 'following, runtime characters', source: viewer, pattern: /\{ runtime: discoveredInPlay, inScene: runtimeInScene \}/ },
    { reader: 'opening pool, picked characters', source: viewer, pattern: /picked: pickedAtStart\(discoveredInPlay\)/ },
    { reader: 'stranger labels, runtime characters', source: viewer, pattern: /\.\.\.discoveredAsEntities\(discoveredInPlay\)\], metEntities/ },
    { reader: 'Test Bench AI context', source: testBench, pattern: /buildAiContext\(benchPlay,/ },
    { reader: 'Test Bench gated world', source: testBench, pattern: /benchPlay = useMemo\(\(\) => inPlayWorldOf\(benchWorld, lensPersonaId, lensOptionValues\)/ },
    { reader: 'Test Bench opening', source: testBench, pattern: /buildOpening\(benchPlay,/ },
    { reader: 'Test Bench lens', source: testBench, pattern: /lensStatOverrides\(benchPlay,/ },
    { reader: 'in-game persona picker', source: read('src/components/game/PersonaRow.tsx'), pattern: /pickedAtStart\(inPlay\.discoveredOn\(discoveredEntities\)\)/ },
  ];

  it.each(gated)('$reader reads the gated list', ({ source, pattern }) => {
    expect(source).toMatch(pattern);
  });

  // The save-load orphan check and the opening fold read the authored world: a gated-off entity's item copies
  // are no orphans, and its stats and starting traits seed the save for the day it turns on.
  it('hands the save load the authored entities', () => {
    expect(viewer.match(/loadGame\([^)]*authoredEntities/g)).toHaveLength(3);
    expect(viewer).not.toMatch(/loadGame\([^)]*codeEntities\.world/);
  });

  it.each(readers)('$reader reads the cast', ({ source, pattern }) => {
    expect(source).toMatch(pattern);
  });

  it('never hands the planner trait names as the player', () => {
    expect(viewer).not.toMatch(/classifyCast\([^)]*traits/i);
  });
});
