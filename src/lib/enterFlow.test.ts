import { describe, it, expect } from 'vitest';
import { buildEnterFlow, navigableSteps, type EnterFlowWorld } from './enterFlow';

/** A world offering nothing: every step has to be earned by the case that wants it. */
const bare: EnterFlowWorld = {
  traitCount: 0,
  startingLocationCount: 1,
  hasCharacterStep: false,
  hasDictionaryStep: false,
  use3DModel: false,
};

const world = (over: Partial<EnterFlowWorld> = {}): EnterFlowWorld => ({ ...bare, ...over });

describe('buildEnterFlow', () => {
  it('opens with the Introduction when the world has one', () => {
    expect(buildEnterFlow(world({ introReadme: '# Welcome', traitCount: 2 }), 'newGame'))
      .toEqual(['intro', 'traits']);
  });

  it('leaves the Introduction out when the world has none', () => {
    expect(buildEnterFlow(world({ traitCount: 2 }), 'newGame')).toEqual(['traits']);
  });

  it('treats whitespace-only Introduction text as none', () => {
    expect(buildEnterFlow(world({ introReadme: '   \n  ', traitCount: 2 }), 'newGame')).toEqual(['traits']);
  });

  it('still shows the Introduction for a world with no traits', () => {
    expect(buildEnterFlow(world({ introReadme: '# Welcome', startingLocationCount: 3 }), 'newGame'))
      .toEqual(['intro', 'location']);
  });

  it('skips every step, Introduction included, on Quick Start', () => {
    expect(buildEnterFlow(world({ introReadme: '# Welcome', traitCount: 2, use3DModel: true }), 'quickStart'))
      .toEqual([]);
  });

  it('skips every step, Introduction included, when a save is loaded', () => {
    expect(buildEnterFlow(world({ introReadme: '# Welcome', traitCount: 2, use3DModel: true }), 'saveLoad'))
      .toEqual([]);
  });

  it('lays the setup steps out in flow order', () => {
    const full = world({
      introReadme: 'hi',
      traitCount: 1,
      startingLocationCount: 2,
      hasCharacterStep: true,
      hasDictionaryStep: true,
      use3DModel: true,
    });
    expect(buildEnterFlow(full, 'newGame'))
      .toEqual(['intro', 'traits', 'location', 'characters', 'dictionaries', 'avatar']);
  });

  it('offers no location step when the world has a single starting location', () => {
    expect(buildEnterFlow(world({ startingLocationCount: 1, traitCount: 1 }), 'newGame')).toEqual(['traits']);
  });

  it('gives an Introduction-only world nothing to overlay', () => {
    expect(buildEnterFlow(world({ introReadme: '# Welcome' }), 'newGame')).toEqual(['intro']);
  });
});

describe('navigableSteps', () => {
  it('drops the Introduction, so Back never targets an overlay', () => {
    expect(navigableSteps(['intro', 'traits', 'location'])).toEqual(['traits', 'location']);
  });

  it('leaves a flow without an Introduction alone', () => {
    expect(navigableSteps(['traits', 'avatar'])).toEqual(['traits', 'avatar']);
  });
});
