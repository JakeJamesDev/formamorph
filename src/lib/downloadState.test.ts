import { describe, it, expect } from 'vitest';
import { getDownloadState } from './downloadState';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-06-01T00:00:00.000Z'; // newer than T1

describe('getDownloadState', () => {
  it('returns "none" when no local copies match', () => {
    expect(getDownloadState(T2, [])).toBe('none');
  });

  it('returns "refresh" when the held source version is current', () => {
    expect(getDownloadState(T1, [{ sourceUpdatedAt: T1 }])).toBe('refresh');
  });

  it('returns "refresh" when the server date equals the held version', () => {
    expect(getDownloadState(T2, [{ sourceUpdatedAt: T2 }])).toBe('refresh');
  });

  it('returns "update" when the server version is strictly newer', () => {
    expect(getDownloadState(T2, [{ sourceUpdatedAt: T1 }])).toBe('update');
  });

  it('defaults to "refresh" when the held copy has no source version stamp', () => {
    expect(getDownloadState(T2, [{}])).toBe('refresh');
  });

  it('defaults to "refresh" when the server date is missing/unparsable', () => {
    expect(getDownloadState(undefined, [{ sourceUpdatedAt: T1 }])).toBe('refresh');
  });

  it('returns "update" if any copy is out of date, even when another is current', () => {
    expect(getDownloadState(T2, [{ sourceUpdatedAt: T1 }, { sourceUpdatedAt: T2 }])).toBe('update');
  });

  it('returns "update" when all copies predate the server', () => {
    expect(getDownloadState(T2, [{ sourceUpdatedAt: T1 }, { sourceUpdatedAt: T1 }])).toBe('update');
  });

  it('returns "refresh" when every copy is current', () => {
    expect(getDownloadState(T2, [{ sourceUpdatedAt: T2 }, { sourceUpdatedAt: T2 }])).toBe('refresh');
  });
});
