import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Tracked text files matching a pattern; git grep exits 1 when none do. */
function tracked(pattern) {
  try {
    return execFileSync('git', ['grep', '-I', '-l', '-E', pattern], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

describe('the repo holds no personal details', () => {
  it('names no Windows user folder other than the placeholder', () => {
    const paths = tracked('([A-Za-z]:[\\\\/]+|/[a-z]/)Users[\\\\/]+[A-Za-z]');
    const named = paths.filter((file) => /(?:[A-Za-z]:[\\/]+|\/[a-z]\/)Users[\\/]+(?!user\b)[A-Za-z]/.test(readFileSync(file, 'utf8')));
    expect(named).toEqual([]);
  });

  it('names no Linux home folder other than the placeholder, CI runners, and the cloud endpoint', () => {
    const named = tracked('/home/[a-z]').filter((file) => /\/home\/(?!user\b|runner\b|fiery\b)[a-z]/.test(readFileSync(file, 'utf8')));
    expect(named).toEqual([]);
  });

  it('lists the project address as the Linux package maintainer', () => {
    expect(readFileSync('electron-builder.yml', 'utf8')).toMatch(/maintainer: .*<[^>]+@formamorph\.ai>/);
  });
});
