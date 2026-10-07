import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Radix keeps its stack of open layers and focus traps per module copy. A second copy means a dialog's trap
// cannot see a menu opened inside it, and pulls focus out of every row the pointer enters.
const SHARED = ['@radix-ui/react-focus-scope', '@radix-ui/react-dismissable-layer'];

const lock = JSON.parse(readFileSync(resolve(__dirname, '../../../package-lock.json'), 'utf8')) as {
  packages: Record<string, { version?: string }>;
};

const versionsOf = (name: string) => new Set(
  Object.entries(lock.packages)
    .filter(([path]) => path.endsWith(`node_modules/${name}`))
    .map(([, entry]) => entry.version),
);

describe('Radix overlay packages', () => {
  it.each(SHARED)('install one copy of %s', (name) => {
    expect([...versionsOf(name)]).toHaveLength(1);
  });
});
