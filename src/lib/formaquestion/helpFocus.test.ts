// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createHelpFocusRegistry, helpFocus, useHelpFocus, type HelpFocus } from './helpFocus';

const courage: HelpFocus = { kind: 'stat', id: 'courage', name: 'Courage' };
const brave: HelpFocus = { kind: 'trait', id: 'brave', name: 'Brave' };

describe('the help focus registry', () => {
  it('holds no focus until a panel registers, and the newest panel wins', () => {
    const registry = createHelpFocusRegistry();
    expect(registry.get()).toBeUndefined();
    const leaveStat = registry.register(courage);
    const leaveTrait = registry.register(brave);
    expect(registry.get()).toBe(brave);
    leaveTrait();
    expect(registry.get()).toBe(courage);
    leaveStat();
    expect(registry.get()).toBeUndefined();
  });

  it('removes the right focus when an older one leaves first, once', () => {
    const registry = createHelpFocusRegistry();
    const leaveStat = registry.register(courage);
    registry.register(brave);
    leaveStat();
    leaveStat();
    expect(registry.get()).toBe(brave);
  });
});

describe('the focus hook', () => {
  it('registers while mounted, follows a rename, skips a blank name, and clears on unmount', () => {
    const panel = renderHook(({ focus }) => useHelpFocus(focus), { initialProps: { focus: courage as HelpFocus | undefined } });
    expect(helpFocus.get()).toEqual(courage);
    panel.rerender({ focus: { ...courage, name: 'Nerve' } });
    expect(helpFocus.get()).toEqual({ ...courage, name: 'Nerve' });
    panel.rerender({ focus: undefined });
    expect(helpFocus.get()).toBeUndefined();
    panel.rerender({ focus: { ...courage, name: ' ' } });
    expect(helpFocus.get()).toBeUndefined();
    panel.rerender({ focus: brave });
    panel.unmount();
    expect(helpFocus.get()).toBeUndefined();
  });
});
