// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PIN_PATHS } from './enginePin.cjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PIN_TO = 'llama-server/llamaServerPin.json';

/**
 * The `to:` targets of each `extraResources` list in electron-builder.yml, keyed by owner: `top` for the
 * top-level list, else the platform key (`win`, `linux`, `mac`).
 */
function extraResourceTargets(yml) {
  const lists = {};
  let platform = null;
  let list = null;
  let listIndent = -1;
  for (const line of yml.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    // This file indents list items deeper than their key, so a line back at the key's depth ends the list.
    if (list && indent <= listIndent) list = null;
    const key = /^(\s*)([A-Za-z]+):\s*$/.exec(line);
    if (indent === 0) platform = key ? key[2] : null;
    if (key && key[2] === 'extraResources') {
      list = lists[indent === 0 ? 'top' : platform] = [];
      listIndent = indent;
      continue;
    }
    const to = /^\s*(?:- )?to:\s*(\S+)\s*$/.exec(line);
    if (list && to) list.push(to[1]);
  }
  return lists;
}

/** Each platform's packaged targets the way electron-builder merges them: the top-level list, then its own. */
const mergedTargets = (lists, platform) => [...(lists.top ?? []), ...(lists[platform] ?? [])];

describe('electron-builder packaging', () => {
  const lists = extraResourceTargets(readFileSync(path.join(HERE, '..', 'electron-builder.yml'), 'utf8'));
  const enginePlatforms = Object.keys(lists).filter((p) => p !== 'top' && lists[p].some((to) => to.startsWith('llama-server/')));

  it('finds the three platforms that bundle llama-server', () => {
    expect(enginePlatforms.sort()).toEqual(['linux', 'mac', 'win']);
  });

  it.each(['win', 'linux', 'mac'])('ships the llama.cpp pin on %s', (platform) => {
    expect(mergedTargets(lists, platform)).toContain(PIN_TO);
  });

  it('ships the pin where a packaged build looks for it', () => {
    // A packaged main runs from resources/app.asar/electron, so resources is two folders up.
    const resources = path.join(HERE, '..', '..');
    expect(path.relative(resources, PIN_PATHS[0]).split(path.sep).join('/')).toBe(PIN_TO);
  });
});
