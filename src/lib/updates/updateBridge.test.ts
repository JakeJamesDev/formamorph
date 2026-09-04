import { describe, expect, it, afterEach } from 'vitest';
import { updateBridge } from '@/lib/updates/updateBridge';

type Shell = { formamorphDesktop?: unknown };

afterEach(() => { delete (window as Shell).formamorphDesktop; });

describe('the update bridge accessor', () => {
  it('finds nothing in the browser', () => {
    expect(updateBridge()).toBeNull();
  });

  it('finds the desktop shell where it is installed', () => {
    const update = { download: async () => {} };
    (window as Shell).formamorphDesktop = { update };

    expect(updateBridge()).toBe(update);
  });

  it('finds nothing in a shell whose updater is switched off', () => {
    // The bridge is optional inside the shell: a build with no updater exposes everything else without it.
    (window as Shell).formamorphDesktop = {};

    expect(updateBridge()).toBeNull();
  });
});
