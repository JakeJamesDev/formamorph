// @vitest-environment node
import { describe, expect, it } from 'vitest';
import config from '../vite.config.js';

describe('Vitest discovery boundaries', () => {
  it('ignores local scratch workspaces', () => {
    expect(config.test?.exclude).toContain('.scratch/**');
  });
});

describe('Vitest worker count', () => {
  it('leaves half the hardware threads free, so a test keeps its speed when another session is busy', () => {
    expect(config.test?.maxWorkers).toBe('50%');
  });
});
