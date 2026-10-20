/**
 * Only the Sandbox Snapshot calls the executor, so no caller assembles a Script's world its own way (Q9). The
 * shared formatters and field lists in the executor's module stay open to everyone.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const SRC = resolve(__dirname, '..');
const SNAPSHOT = join('lib', 'sandboxSnapshot.ts');
const EXECUTOR = join('lib', 'statCodeExecutor.ts');

const sourceFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return sourceFiles(path);
  return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !path.includes(`${sep}test${sep}`) ? [path] : [];
});

/** Whether `text` reaches `executeStatCode`: by name, re-exported, through a namespace, or through a dynamic import. */
const importsExecutor = (text: string): boolean =>
  /(?:import|export)\s*(?:type\s*)?\{[^}]*\bexecuteStatCode\b[^}]*\}\s*from\s*['"][^'"]*statCodeExecutor['"]/.test(text)
  || /(?:import|export)\s*\*\s*(?:as\s+\w+\s*)?from\s*['"][^'"]*statCodeExecutor['"]/.test(text)
  || /\bexecuteStatCode\b[^;]*=\s*await\s+import\(\s*['"][^'"]*statCodeExecutor['"]\s*\)/.test(text)
  || /import\(\s*['"][^'"]*statCodeExecutor['"]\s*\)[\s\S]{0,200}?\bexecuteStatCode\b/.test(text);

describe('the executor boundary', () => {
  it('lets no non-test file outside the snapshot import the executor', () => {
    const offenders = sourceFiles(SRC)
      .map((path) => relative(SRC, path))
      .filter((path) => path !== SNAPSHOT && path !== EXECUTOR)
      .filter((path) => importsExecutor(readFileSync(join(SRC, path), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('spots an executor import in each form it can take', () => {
    expect(importsExecutor(`import { executeStatCode } from '@/lib/statCodeExecutor';`)).toBe(true);
    expect(importsExecutor(`import {\n  clampToOwnRange, executeStatCode,\n} from './statCodeExecutor';`)).toBe(true);
    expect(importsExecutor(`const { executeStatCode } = await import('@/lib/statCodeExecutor');`)).toBe(true);
    expect(importsExecutor(`import * as sandbox from './statCodeExecutor';`)).toBe(true);
    expect(importsExecutor(`export { executeStatCode } from './statCodeExecutor';`)).toBe(true);
    expect(importsExecutor(`export * from './statCodeExecutor';`)).toBe(true);
    expect(importsExecutor(`import { clampToOwnRange, CODE_BOUND_FIELDS } from '@/lib/statCodeExecutor';`)).toBe(false);
  });
});
