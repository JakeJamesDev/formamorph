import { describe, it, expect } from 'vitest';
import handoff from './launcherHandoff.cjs';

const { launcherToRestartThrough, taskbarDetails } = handoff;

const ROOT = 'C:\\Games\\Formamorph';
const INNER = `${ROOT}\\app\\Formamorph.exe`;
const LAUNCHER = `${ROOT}\\Formamorph.exe`;

const start = (over = {}) => launcherToRestartThrough({
  platform: 'win32',
  isPackaged: true,
  env: {},
  execPath: INNER,
  exists: (p) => p === LAUNCHER,
  ...over,
});

describe('launcher handoff', () => {
  it('restarts a direct start of the inner exe through the launcher', () => {
    expect(start()).toBe(LAUNCHER);
  });

  it('leaves a launcher start alone', () => {
    expect(start({ env: { FORMAMORPH_ROOT: ROOT } })).toBeNull();
  });

  it('keeps running when the launcher is missing', () => {
    expect(start({ exists: () => false })).toBeNull();
  });

  it('only applies to the packaged Windows layout', () => {
    expect(start({ platform: 'linux' })).toBeNull();
    expect(start({ isPackaged: false })).toBeNull();
    expect(start({ execPath: `${ROOT}\\Formamorph.exe` })).toBeNull();
  });

  it('matches the app folder in any case', () => {
    expect(start({ execPath: `${ROOT}\\App\\Formamorph.exe` })).toBe(LAUNCHER);
  });
});

describe('taskbar details', () => {
  it('points a pinned window at the launcher', () => {
    const d = taskbarDetails({ platform: 'win32', env: { FORMAMORPH_ROOT: ROOT }, appId: 'id', execPath: INNER });
    expect(d).toMatchObject({ appId: 'id', relaunchCommand: `"${LAUNCHER}"`, relaunchDisplayName: 'Formamorph' });
  });

  it('sets nothing outside a launcher start', () => {
    expect(taskbarDetails({ platform: 'win32', env: {}, appId: 'id', execPath: INNER })).toBeNull();
    expect(taskbarDetails({ platform: 'darwin', env: { FORMAMORPH_ROOT: ROOT }, appId: 'id', execPath: INNER })).toBeNull();
  });
});
