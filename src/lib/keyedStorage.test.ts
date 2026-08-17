import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createKeyedRecordStore, readStorageJson, writeStorageJson } from './keyedStorage';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readStorageJson', () => {
  it('reads nothing from a key that was never written', () => {
    expect(readStorageJson('local', 'FMB_TEST_absent')).toBeUndefined();
  });

  it('reads corrupt JSON as nothing rather than throwing', () => {
    localStorage.setItem('FMB_TEST_corrupt', '{not json');
    expect(readStorageJson('local', 'FMB_TEST_corrupt')).toBeUndefined();
  });

  it('reads as nothing when storage itself is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readStorageJson('local', 'FMB_TEST_blocked')).toBeUndefined();
  });

  it('round-trips what writeStorageJson stored, on the storage it stored to', () => {
    writeStorageJson('session', 'FMB_TEST_rt', ['a', 'b']);
    expect(readStorageJson('session', 'FMB_TEST_rt')).toEqual(['a', 'b']);
    // The two backings are separate stores, not two names for one.
    expect(readStorageJson('local', 'FMB_TEST_rt')).toBeUndefined();
  });
});

describe('writeStorageJson', () => {
  it('swallows a write failure, so a full storage never reaches the caller', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => writeStorageJson('local', 'FMB_TEST_full', { a: 1 })).not.toThrow();
  });
});

describe('createKeyedRecordStore', () => {
  it('reads nothing for an id with no entry', () => {
    const store = createKeyedRecordStore('session', 'FMB_TEST_record');
    expect(store.read('w1')).toBeUndefined();
  });

  it('writes per id and merges over the other ids', () => {
    const store = createKeyedRecordStore('session', 'FMB_TEST_record');
    store.write('w1', { pick: 'a' });
    store.write('w2', { pick: 'b' });
    expect(store.read('w1')).toEqual({ pick: 'a' });
    expect(store.read('w2')).toEqual({ pick: 'b' });
  });

  it('reads a corrupt or wrong-shaped record as empty rather than throwing', () => {
    sessionStorage.setItem('FMB_TEST_record', '{broken');
    const store = createKeyedRecordStore('session', 'FMB_TEST_record');
    expect(store.read('w1')).toBeUndefined();
    // A value that parses but isn't a record (someone else's array under our key) also reads as empty.
    sessionStorage.setItem('FMB_TEST_record', '["w1"]');
    expect(store.read('w1')).toBeUndefined();
  });

  it('recovers a corrupt record on the next write instead of appending to garbage', () => {
    sessionStorage.setItem('FMB_TEST_record', '{broken');
    const store = createKeyedRecordStore('session', 'FMB_TEST_record');
    store.write('w1', 'fresh');
    expect(store.read('w1')).toBe('fresh');
  });
});
