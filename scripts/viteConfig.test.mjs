// @vitest-environment node
import { describe, expect, it } from 'vitest';
import config from '../vite.config.js';

describe('Vitest discovery boundaries', () => {
  it('ignores local scratch workspaces', () => {
    expect(config.test?.exclude).toContain('.scratch/**');
  });
});
