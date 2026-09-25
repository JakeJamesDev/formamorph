import { describe, it, expect } from 'vitest';
import { CATALOG_KINDS, CARD_TYPE_BY_KIND, KIND_BY_CARD_TYPE, KIND_ICONS, KIND_LABELS, kindHasThumbnail, kindOf, showsMorphArt } from './catalogKinds';
import { PUBLISH_LIMITS } from './publishLimits';
import { BROWSE_TABS } from './browseTabs';

describe('kindOf', () => {
  it('reads a kind the server sent', () => {
    expect(kindOf({ kind: 'entity' })).toBe('entity');
    expect(kindOf({ kind: 'dictionary' })).toBe('dictionary');
    expect(kindOf({ kind: 'world' })).toBe('world');
    expect(kindOf({ kind: 'model' })).toBe('model');
    expect(kindOf({ kind: 'prompt' })).toBe('prompt');
  });

  it('treats a record with no kind as a world', () => {
    // Catalog entries cached before kinds existed carry no `kind`; they must still render as worlds
    // rather than vanish from every tab until the background refresh lands.
    expect(kindOf({})).toBe('world');
  });

  it('treats an unknown kind as a world rather than dropping it', () => {
    // A newer server could publish a kind this build has never heard of; showing it as a world is wrong
    // but visible, which beats a listing that silently belongs to no tab.
    expect(kindOf({ kind: 'spaceship' })).toBe('world');
    expect(kindOf({ kind: 'all' })).toBe('world'); // 'all' is a query, never a row's kind
  });
});

describe('showsMorphArt', () => {
  it('draws Morph art for an entity the server flags', () => {
    expect(showsMorphArt({ kind: 'entity', placeholder: true })).toBe(true);
  });

  it('keeps the stored thumbnail when the flag is off or missing', () => {
    expect(showsMorphArt({ kind: 'entity', placeholder: false })).toBe(false);
    // A server without the flag omits it; its listings show their thumbnails as before.
    expect(showsMorphArt({ kind: 'entity' })).toBe(false);
  });

  it('never replaces an avatar or world thumbnail', () => {
    expect(showsMorphArt({ kind: 'model', placeholder: true })).toBe(false);
    expect(showsMorphArt({ kind: 'world', placeholder: true })).toBe(false);
  });
});

describe('kind mappings', () => {
  it('round-trips every library kind through the local library tab value', () => {
    for (const kind of Object.keys(CARD_TYPE_BY_KIND) as (keyof typeof CARD_TYPE_BY_KIND)[]) {
      expect(KIND_BY_CARD_TYPE[CARD_TYPE_BY_KIND[kind]]).toBe(kind);
    }
  });

  it('gives a prompt no library tab, because presets live in Settings', () => {
    expect(Object.keys(CARD_TYPE_BY_KIND).sort()).toEqual(CATALOG_KINDS.filter((k) => k !== 'prompt').sort());
    expect(Object.values(KIND_BY_CARD_TYPE)).not.toContain('prompt');
  });

  it('gives every kind an icon, a publish limit, and a browse section', () => {
    for (const kind of CATALOG_KINDS) {
      expect(KIND_ICONS[kind]).toBeTruthy();
      expect(PUBLISH_LIMITS[kind]).toBeGreaterThan(0);
      expect(BROWSE_TABS).toContain(kind);
    }
  });

  it('sets the prompt kind apart: its own label, a 1 MB limit, and no thumbnail', () => {
    expect(KIND_LABELS.prompt).toEqual({ one: 'Prompt', many: 'Prompts' });
    expect(PUBLISH_LIMITS.prompt).toBe(1024 * 1024);
    expect(kindHasThumbnail('prompt')).toBe(false);
    expect(CATALOG_KINDS.filter(kindHasThumbnail)).toEqual(['world', 'entity', 'dictionary', 'model']);
  });

  it('labels every kind', () => {
    for (const kind of CATALOG_KINDS) {
      expect(KIND_LABELS[kind].one).toBeTruthy();
      expect(KIND_LABELS[kind].many).toBeTruthy();
    }
  });

  it('matches the server’s kinds', () => {
    // Mirrors FormamorphServer's config/kinds KINDS — they must not drift.
    expect([...CATALOG_KINDS]).toEqual(['world', 'entity', 'dictionary', 'model', 'prompt']);
  });
});
