// The answer keys hold against the fixtures: a game case's leaks are out of what the shipped arm sends for its
// question and in what the full arm reads, and every fact a case keys is in the text its lean reads.
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firedLore, playerViewPages, type GameWorldInput } from '@/lib/formaquestion/gameWorld';
import { buildWorldIndex } from '@/lib/formaquestion/worldIndex';
import { bundledWorld, fullInputOf, GAME_SAVES, gameInputOf, WORLD_IDS, WORLD_QUESTION_CASES, type WorldId } from './world-question-cases';

/** Every word a game request for `question` can carry: the Player View rows, the story, and the entries the question fires. */
const reachable = (input: GameWorldInput, question: string) => [
  ...playerViewPages(input.view).map((page) => page.markdown),
  input.story.text,
  ...firedLore(input, question, null).map((entry) => `${entry.name}\n${input.resolve(entry.value)}`),
].join('\n\n');

/** Every section of the editor's World Index. */
const editorText = (id: WorldId) => buildWorldIndex(bundledWorld(id)).pickList().sections.flat().map((section) => section.markdown).join('\n\n');

const games = Object.entries(GAME_SAVES) as [WorldId, NonNullable<(typeof GAME_SAVES)[WorldId]>][];
const gameCases = WORLD_QUESTION_CASES.filter((c) => c.lean === 'game');

describe('the world-question cases', () => {
  it('cover every bundled world, and every world with a cast in game', () => {
    const bundled = readdirSync('src/defaultworlds').filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -'.json'.length));
    expect([...WORLD_IDS].sort()).toEqual(bundled.sort());
    expect(new Set(WORLD_QUESTION_CASES.filter((c) => c.lean === 'editor').map((c) => c.world))).toEqual(new Set(WORLD_IDS));
    expect(new Set(gameCases.map((c) => c.world))).toEqual(new Set(WORLD_IDS.filter((id) => id !== 'open-chat')));
    expect(new Set(WORLD_QUESTION_CASES.filter((c) => c.opinion).map((c) => c.world))).toEqual(new Set(games.map(([id]) => id)));
  });

  it.each(gameCases)('$id: keeps each leak out of what the shipped arm sends', (c) => {
    const { save, leaks } = GAME_SAVES[c.world]!;
    const shipped = reachable(gameInputOf(bundledWorld(c.world), save), c.question);
    for (const leak of leaks) expect(shipped, leak.label).not.toMatch(leak.pattern);
  });

  it.each(games)('%s: holds each leak in the full world the full arm reads', (id, { save, leaks }) => {
    const input = fullInputOf(bundledWorld(id), save);
    const full = [...playerViewPages(input.view).map((page) => page.markdown), ...input.lore.map((entry) => `${entry.name}\n${input.resolve(entry.value)}`)].join('\n\n');
    for (const leak of leaks) expect(full, leak.label).toMatch(leak.pattern);
  });

  it.each(WORLD_QUESTION_CASES.filter((c) => c.facts.length))('$id: keys facts its lean can read', (c) => {
    const text = c.lean === 'editor' ? editorText(c.world) : reachable(gameInputOf(bundledWorld(c.world), GAME_SAVES[c.world]!.save), c.question);
    for (const fact of c.facts) expect(text, fact.label).toMatch(fact.pattern);
  });
});
