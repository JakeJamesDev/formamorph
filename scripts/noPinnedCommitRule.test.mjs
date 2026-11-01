// @vitest-environment node
import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import { noPinnedCommitRule } from '../eslint.no-pinned-commit.js';

const lint = (code) => new Linter().verify(code, {
  plugins: { formamorph: { rules: { 'no-pinned-commit': noPinnedCommitRule } } },
  rules: { 'formamorph/no-pinned-commit': 'error' },
}).map((message) => message.messageId ?? message.message);

// Built here so this file holds no sha of its own.
const SHA = 'ab12'.repeat(10);

describe('no-pinned-commit', () => {
  it('flags a sha in a string, in a longer string, and in a template', () => {
    expect(lint(`const a = '${SHA}';`)).toEqual(['pinnedCommit']);
    expect(lint(`const a = 'git show ${SHA}:src/a.json';`)).toEqual(['pinnedCommit']);
    expect(lint(`const a = \`\${b}/${SHA}\`;`)).toEqual(['pinnedCommit']);
  });

  it('leaves a short sha, a 64-digit hash, and a sha in a comment alone', () => {
    expect(lint(`const a = '${SHA.slice(0, 9)}';`)).toEqual([]);
    expect(lint(`const a = '${SHA}${SHA.slice(0, 24)}';`)).toEqual([]);
    expect(lint(`// ${SHA}\nconst a = 1;`)).toEqual([]);
  });
});
