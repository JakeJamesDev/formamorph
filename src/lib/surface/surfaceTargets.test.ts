import { describe, expect, it } from 'vitest';
import { SURFACE_IDS } from '@/lib/docs/surfaceMap';
import { resolveSurface } from './surfaceRoute';
import { isSurfaceTarget, SURFACE_TARGETS, targetAttribute } from './surfaceTargets';

describe('SURFACE_TARGETS', () => {
  it('keys every entry by a surface id', () => {
    expect(Object.keys(SURFACE_TARGETS).filter((id) => !(SURFACE_IDS as readonly string[]).includes(id))).toEqual([]);
  });

  it('names every target in kebab-case, once per surface', () => {
    for (const [surface, targets] of Object.entries(SURFACE_TARGETS)) {
      expect(targets.filter((target) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(target)), surface).toEqual([]);
      expect(new Set(targets).size, surface).toBe(targets.length);
    }
  });

  it('registers targets only on surfaces that open as themselves', () => {
    for (const surface of Object.keys(SURFACE_TARGETS)) {
      const steps = resolveSurface(surface);
      expect(steps && (steps.tabs.at(-1) ?? steps.dialog ?? steps.view), surface).toBe(surface);
    }
  });
});

describe('isSurfaceTarget', () => {
  it('accepts a registered target of the surface only', () => {
    expect(isSurfaceTarget('settings.display', 'narration-layout')).toBe(true);
    expect(isSurfaceTarget('settings.display', 'narration')).toBe(false);
    expect(isSurfaceTarget('settings.output', 'narration-layout')).toBe(false);
    expect(isSurfaceTarget('nowhere', 'narration-layout')).toBe(false);
  });
});

describe('targetAttribute', () => {
  it('names the surface and the target', () => {
    expect(targetAttribute('settings.display', 'narration-layout')).toEqual({
      'data-surface-target': 'settings.display#narration-layout',
    });
  });

  it('rejects a target the registry lacks at compile time', () => {
    // @ts-expect-error: settings.display registers no such target.
    targetAttribute('settings.display', 'narration-font-size');
    // @ts-expect-error: settings.output registers no targets.
    targetAttribute('settings.output', 'narration-layout');
  });
});
