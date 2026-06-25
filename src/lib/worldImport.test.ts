import { describe, it, expect } from 'vitest';
import { normalizeCustomVRM } from './worldImport';

describe('normalizeCustomVRM', () => {
  it('returns null for absent/empty values', () => {
    expect(normalizeCustomVRM(null)).toBeNull();
    expect(normalizeCustomVRM(undefined)).toBeNull();
    expect(normalizeCustomVRM('')).toBeNull();
  });

  it('wraps a v1.2 bare data-URL string into a MediaAsset', () => {
    const url = 'data:application/octet-stream;base64,Z2xURgIAAAD45iEB';
    expect(normalizeCustomVRM(url)).toEqual({ data: url, type: 'model/vrm' });
  });

  it('ignores a non-data-URL string', () => {
    expect(normalizeCustomVRM('not-a-data-url')).toBeNull();
  });

  it('passes through our { data, type } object', () => {
    const asset = { data: 'data:model/vrm;base64,AAAA', type: 'model/vrm' };
    expect(normalizeCustomVRM(asset)).toEqual(asset);
  });

  it('defaults the type when only data is present', () => {
    expect(normalizeCustomVRM({ data: 'data:foo;base64,AAAA' })).toEqual({
      data: 'data:foo;base64,AAAA',
      type: 'model/vrm',
    });
  });

  it('returns null for an object without usable data', () => {
    expect(normalizeCustomVRM({ type: 'model/vrm' })).toBeNull();
    expect(normalizeCustomVRM({ data: 123 })).toBeNull();
  });
});
