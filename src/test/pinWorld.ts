import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateWorld } from '@/lib/version';
import type { World } from '@/types';

/**
 * The editor-speed pin world with 1-pixel images: "Mood" pinned 551 times, three sources pinning 200 each.
 * Generated into a temporary folder that is gone when this returns.
 */
export function loadPinWorld(): World {
  const dir = mkdtempSync(join(tmpdir(), 'pin-world-'));
  try {
    const out = join(dir, 'pins.json');
    execFileSync(process.execPath, ['testing/editor-speed/genLargeWorld.mjs', '--pins', '1', '--image', '1', '--out', out], { stdio: 'ignore' });
    return migrateWorld(JSON.parse(readFileSync(out, 'utf8')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
