// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { emptyToolSnapshot, sampleToolSnapshot } from '@/lib/tools/toolSnapshot';
import { createHelpWorldRegistry, helpWorld, useHelpWorld, useHelpWorldSource } from './helpWorld';

describe('the open-world registry', () => {
  it('holds no world until a source registers, and the newest source wins', () => {
    const registry = createHelpWorldRegistry();
    expect(registry.get()).toBeUndefined();
    const game = () => emptyToolSnapshot();
    const editor = () => emptyToolSnapshot();
    const leaveGame = registry.register(game);
    expect(registry.get()).toBe(game);
    const leaveEditor = registry.register(editor);
    expect(registry.get()).toBe(editor);
    leaveEditor();
    expect(registry.get()).toBe(game);
    leaveGame();
    expect(registry.get()).toBeUndefined();
  });

  it('removes the right source when an older one leaves first', () => {
    const registry = createHelpWorldRegistry();
    const first = () => emptyToolSnapshot();
    const second = () => emptyToolSnapshot();
    const leaveFirst = registry.register(first);
    registry.register(second);
    leaveFirst();
    expect(registry.get()).toBe(second);
    leaveFirst();
    expect(registry.get()).toBe(second);
  });

  it('tells its subscribers on each change, and stops after unsubscribe', () => {
    const registry = createHelpWorldRegistry();
    const listener = vi.fn();
    const stop = registry.subscribe(listener);
    const leave = registry.register(() => emptyToolSnapshot());
    leave();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    registry.register(() => emptyToolSnapshot());
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('the registry hooks', () => {
  it('register a source while mounted, and the reader follows it', () => {
    const build = () => emptyToolSnapshot();
    const reader = renderHook(() => useHelpWorld());
    expect(reader.result.current).toBeUndefined();
    const source = renderHook(() => useHelpWorldSource(build));
    expect(helpWorld.get()?.()).toEqual(build());
    expect(reader.result.current).toBe(helpWorld.get());
    source.unmount();
    expect(helpWorld.get()).toBeUndefined();
    expect(reader.result.current).toBeUndefined();
  });

  it('keep the editor over the game while it is open, and the game’s live source after it closes (Q63)', () => {
    const ids = () => helpWorld.get()?.().world.entities.map((entity) => entity.id);
    const game = renderHook(({ build }) => useHelpWorldSource(build), { initialProps: { build: sampleToolSnapshot } });
    const editor = renderHook(() => useHelpWorldSource(emptyToolSnapshot));
    // The game's builder changes every turn; the editor stays on top regardless.
    game.rerender({ build: emptyToolSnapshot });
    game.rerender({ build: sampleToolSnapshot });
    expect(ids()).toEqual([]);

    editor.unmount();
    // The builder the game holds now, not the one it mounted with.
    expect(ids()).toContain('wren');
    game.rerender({ build: emptyToolSnapshot });
    expect(ids()).toEqual([]);
    game.unmount();
    expect(helpWorld.get()).toBeUndefined();
  });
});
