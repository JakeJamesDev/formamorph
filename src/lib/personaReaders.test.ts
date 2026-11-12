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

  it('builds the game view cast from the resolved world, plus the discovered characters', () => {
    expect(destructuredFrom(viewer, 'useResolvedWorld')).toEqual(['entities']);
    expect(viewer).toMatch(/const allEntities = useMemo\(\s*\(\) => \[\.\.\.entities, \.\.\.discoveredAsEntities\(discoveredEntities\)\]/);
  });

  // One row per reader the spec names. Each pattern pins the list the reader is handed to a cast name.
  const readers: Array<{ reader: string; source: string; pattern: RegExp }> = [
    // The roster chips read the live Chip Scene: Here and In Scene from the full cast, the outer scopes from
    // the authored cast. liveScene.test.ts proves the rendering; this pins which list the scene is handed.
    { reader: 'roster chip', source: liveScene, pattern: /entities: allEntities,/ },
    { reader: 'roster chip, sublocations and reachable', source: liveScene, pattern: /outerScopeEntities: ownText\(sources\.entities\),/ },
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

  it.each(readers)('$reader reads the cast', ({ source, pattern }) => {
    expect(source).toMatch(pattern);
  });

  it('never hands the planner trait names as the player', () => {
    expect(viewer).not.toMatch(/classifyCast\([^)]*traits/i);
  });
});
