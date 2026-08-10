import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The find bar tells two fields apart by their caption, matching a target's `fieldLabel` against the
 * `data-find-field` a `PromptField` renders from its `label`. Nothing at runtime notices when the two
 * drift — navigation just quietly falls back to guessing by text, which is wrong precisely where it
 * matters: an AI description seeded from the player-facing one holds identical text.
 *
 * So every caption search relies on has to still exist in a manager panel.
 */

const MANAGERS = join(process.cwd(), 'src', 'managers');

/** Captions `collectSearchTargets` assigns to fields that render as a captioned `PromptField`. */
const RELIED_ON = [
  'Player-Facing Description',
  'AI-Facing Description',
  'AI-Facing Summary',
  'World Description',
  'System Prompt Addition',
  'Readme',
  'Value',
];

/** Captions on the chip and plain-input fields, which caption with a sibling `<Label>` instead. */
const RELIED_ON_PLAIN = [
  'Aliases',
  'Trigger Keywords',
  'Secondary Keywords',
  'World Name',
  'Dictionary Name',
  'Group Name',
  'Tags',
];

const captions = () => {
  const found = new Set<string>();
  for (const file of readdirSync(MANAGERS).filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))) {
    const source = readFileSync(join(MANAGERS, file), 'utf8');
    for (const m of source.matchAll(/\blabel="([^"]+)"/g)) found.add(m[1]);
    for (const m of source.matchAll(/<Label[^>]*>([^<{]+)<\/Label>/g)) found.add(m[1].trim());
  }
  return [...found];
};

describe('find-bar field captions', () => {
  it('finds captions to check', () => {
    // Guards the guard: a regex that stopped matching would pass every case below forever.
    expect(captions().length).toBeGreaterThan(8);
  });

  it.each([...RELIED_ON, ...RELIED_ON_PLAIN])('a manager still captions a field "%s"', (label) => {
    // A prefix, so a caption may carry a parenthetical the search readout leaves off.
    expect(captions().filter((c) => c.startsWith(label))).not.toEqual([]);
  });
});
