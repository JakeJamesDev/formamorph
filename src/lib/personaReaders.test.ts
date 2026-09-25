// A source scan, since the game view is too large to mount; GameplayContext.persona.test.tsx proves the cast.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const gameComponents = (readdirSync(join(process.cwd(), 'src/components/game'), { recursive: true }) as string[])
  .map((f) => f.replace(/\\/g, '/'))
  .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
  .map((f) => `src/components/game/${f}`);
const inPlayFiles = ['src/views/GameViewer.tsx', ...gameComponents];

/** The entity names a destructure of `hook()` takes, or [] when the file has none. */
const destructuredFrom = (source: string, hook: string): string[] =>
  [...source.matchAll(new RegExp(`const\\s*\\{([^}]*)\\}\\s*=\\s*${hook}\\(`, 'g'))]
    .flatMap((m) => m[1].split(','))
    .map((part) => part.trim())
    .filter((part) => /^entities\b/.test(part));

describe('entity readers in play', () => {
  it.each(inPlayFiles)('%s never reads the raw authored entity list', (path) => {
    const source = read(path);
    expect(destructuredFrom(source, 'useGameData')).toEqual([]);
    expect(source).not.toMatch(/useGameData\(\)\.entities|gameData\.entities/);
    const handles = [...source.matchAll(/const (\w+) = useGameData\(\)/g)].map((m) => m[1]);
    for (const handle of handles) expect(source).not.toMatch(new RegExp(`\\b${handle}\\.entities\\b`));
    expect(source).not.toMatch(/useResolvedAuthoredWorld\(/);
  });

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
    { reader: 'roster chip, sublocations and reachable', source: liveScene, pattern: /outerScopeEntities: resolveEntityTexts\(sources\.entities, resolveEntity\),/ },
    { reader: 'roster chip, live view hands the adapter both casts', source: viewer, pattern: /entities,\s*allEntities,\s*participants,/ },
    { reader: 'prose parse for participation', source: viewer, pattern: /readNarration\(\{[^}]*entities: allEntities,/ },
    { reader: 'participation fan-out', source: viewer, pattern: /splitParticipants\(turnParticipants, allEntities,/ },
    { reader: 'diaries', source: viewer, pattern: /const entity = allEntities\.find\(\(e\) => e\.name\.trim\(\)/ },
    { reader: 'discovery matching', source: viewer, pattern: /const knownNames = \[\.\.\.allEntities\.map/ },
    { reader: 'discovery exclusions', source: viewer, pattern: /characters: clean\(\[\.\.\.allEntities\.map\(\(e\) => e\.name\), \.\.\.playerNames\]\)/ },
    { reader: 'scene tags', source: viewer, pattern: /\.map\(\(name\) => allEntities\.find\(\(e\) => sameCharacterName\(e\.name, name\)\)\)/ },
    { reader: "planner's cast", source: viewer, pattern: /classifyCast\(cast, allEntities, playerNames\)/ },
    { reader: 'in-game entity panel', source: viewer, pattern: /entities=\{allEntities\}/ },
    { reader: 'opening pool, regenerate and load', source: viewer, pattern: /const sessionPool = \(\) => openingPool\(\{\s*overview: worldOverview,\s*entities,/ },
    { reader: 'panels, scene list', source: panels, pattern: /const \{ entities: authoredEntities(?:, \w+)* \} = useResolvedWorld\(\)/ },
    { reader: 'panels, narration names', source: panels, pattern: /const \{ entities \} = useResolvedWorld\(\)/ },
  ];

  it.each(readers)('$reader reads the cast', ({ source, pattern }) => {
    expect(source).toMatch(pattern);
  });

  it('never hands the planner trait names as the player', () => {
    expect(viewer).not.toMatch(/classifyCast\([^)]*traits/i);
  });
});
