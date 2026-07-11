import { describe, it, expect } from 'vitest';
import { initialUpdateState, updateReducer, type UpdateState } from './updateState';

const base = (): UpdateState => initialUpdateState('2.1.0', 'stable');

describe('updateReducer', () => {
  it('starts idle and enters checking', () => {
    const s = base();
    expect(s.phase).toBe('idle');
    expect(updateReducer(s, { type: 'CHECK_START' }).phase).toBe('checking');
  });

  it('CHECK_RESULT available → available with version + notes', () => {
    const s = updateReducer(base(), { type: 'CHECK_RESULT', available: true, latestVersion: '2.2.0', changelog: 'notes', at: 100 });
    expect(s.phase).toBe('available');
    expect(s.latestVersion).toBe('2.2.0');
    expect(s.changelog).toBe('notes');
    expect(s.lastCheckedAt).toBe(100);
  });

  it('CHECK_RESULT not-available → up-to-date, clears any prior target', () => {
    let s = updateReducer(base(), { type: 'CHECK_RESULT', available: true, latestVersion: '2.2.0', changelog: 'x', at: 1 });
    s = updateReducer(s, { type: 'CHECK_RESULT', available: false, changelog: 'current notes', at: 2 });
    expect(s.phase).toBe('up-to-date');
    expect(s.latestVersion).toBeUndefined();
    expect(s.changelog).toBe('current notes');
  });

  it('accumulates download progress then completes', () => {
    let s = updateReducer(base(), { type: 'DOWNLOAD_START' });
    expect(s.phase).toBe('downloading');
    expect(s.downloadPct).toBe(0);
    s = updateReducer(s, { type: 'DOWNLOAD_PROGRESS', received: 50, total: 200 });
    expect(s.downloadPct).toBe(25);
    expect(s.bytesReceived).toBe(50);
    s = updateReducer(s, { type: 'DOWNLOAD_DONE' });
    expect(s.phase).toBe('downloaded');
    expect(s.downloadPct).toBe(100);
  });

  it('keeps the last pct when total is unknown (0)', () => {
    let s = updateReducer(base(), { type: 'DOWNLOAD_START' });
    s = updateReducer(s, { type: 'DOWNLOAD_PROGRESS', received: 10, total: 0 });
    expect(s.downloadPct).toBe(0);
  });

  it('ERROR records the message', () => {
    const s = updateReducer(base(), { type: 'ERROR', error: 'boom' });
    expect(s.phase).toBe('error');
    expect(s.error).toBe('boom');
  });

  it('SET_CHANNEL resets to a fresh idle state on the new channel', () => {
    let s = updateReducer(base(), { type: 'CHECK_RESULT', available: true, latestVersion: '2.2.0', changelog: 'x', at: 1 });
    s = updateReducer(s, { type: 'SET_CHANNEL', channel: 'prerelease' });
    expect(s.phase).toBe('idle');
    expect(s.channel).toBe('prerelease');
    expect(s.currentVersion).toBe('2.1.0');
    expect(s.latestVersion).toBeUndefined();
  });
});
