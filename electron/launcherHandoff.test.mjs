import { describe, it, expect, vi } from 'vitest';
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

describe('direct-start notice', () => {
  const run = (choice) => {
    const calls = [];
    const dialog = { showMessageBoxSync: (opts) => { calls.push(['dialog', opts]); return choice; } };
    handoff.handOff({
      launcher: LAUNCHER,
      argv: ['--x'],
      dialog,
      reveal: (f) => calls.push(['reveal', f]),
      spawn: (exe, argv) => calls.push(['spawn', exe, argv]),
    });
    return calls;
  };

  it('shows the box once with the launcher path, then starts the launcher on OK', () => {
    const calls = run(0);
    expect(calls.map((c) => c[0])).toEqual(['dialog', 'spawn']);
    expect(calls[0][1].detail).toContain(LAUNCHER);
    expect(calls[0][1].buttons).toEqual(['OK', 'Show in Folder']);
    expect(calls[1]).toEqual(['spawn', LAUNCHER, ['--x']]);
  });

  it('reveals the launcher on Show in Folder, then still starts it', () => {
    const calls = run(1);
    expect(calls.map((c) => c[0])).toEqual(['dialog', 'reveal', 'spawn']);
    expect(calls[1]).toEqual(['reveal', LAUNCHER]);
  });

  it('still starts the launcher when the box or the reveal fails', () => {
    const spawned = [];
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = () => { throw new Error('boom'); };
    const base = { launcher: LAUNCHER, argv: [], spawn: (exe) => spawned.push(exe) };
    handoff.handOff({ ...base, dialog: { showMessageBoxSync: boom }, reveal: () => {} });
    handoff.handOff({ ...base, dialog: { showMessageBoxSync: () => 1 }, reveal: boom });
    quiet.mockRestore();
    expect(spawned).toEqual([LAUNCHER, LAUNCHER]);
  });

  it('shows the box before the launcher starts', () => {
    expect(run(0)[0][0]).toBe('dialog');
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
