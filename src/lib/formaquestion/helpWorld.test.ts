// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { emptyToolSnapshot, sampleToolSnapshot } from '@/lib/tools/toolSnapshot';
import { emptyCodeWorld, openWorld } from '@/test/helpFixtures';
import { createHelpWorldRegistry, helpWorld, useHelpWorld, useHelpWorldSource } from './helpWorld';

describe('the open-world registry', () => {
  it('holds no world until a source registers, and the newest source wins', () => {
    const registry = createHelpWorldRegistry();
    expect(registry.get()).toBeUndefined();
    const game = openWorld();
    const editor = openWorld();
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
    const first = openWorld();
    const second = openWorld();
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
    const leave = registry.register(openWorld());
    leave();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    registry.register(openWorld());
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('the registry hooks', () => {
  it('register a source while mounted, and the reader follows it', () => {
    const build = () => emptyToolSnapshot();
    const reader = renderHook(() => useHelpWorld());
    expect(reader.result.current).toBeUndefined();
    const source = renderHook(() => useHelpWorldSource(build, emptyCodeWorld));
    expect(helpWorld.get()?.snapshot()).toEqual(build());
    expect(helpWorld.get()?.authored()).toEqual(emptyCodeWorld());
    expect(reader.result.current).toBe(helpWorld.get());
    source.unmount();
    expect(helpWorld.get()).toBeUndefined();
    expect(reader.result.current).toBeUndefined();
  });

  it('keep the editor over the game while it is open, and the game’s live source after it closes (Q63)', () => {
    const ids = () => helpWorld.get()?.snapshot().world.entities.map((entity) => entity.id);
    const statNames = () => helpWorld.get()?.authored().stats.map((stat) => stat.name);
    const gameWorld = (name: string) => () => ({ ...emptyCodeWorld(), stats: [{ id: name, name, type: 'number' as const, description: '', value: 0, min: 0, max: 100, regen: 0, descriptors: [] }] });
    const game = renderHook(({ build, authored }) => useHelpWorldSource(build, authored), {
      initialProps: { build: sampleToolSnapshot, authored: gameWorld('Courage') },
    });
    const editor = renderHook(() => useHelpWorldSource(emptyToolSnapshot, emptyCodeWorld));
    // The game's builders change every turn; the editor stays on top regardless.
    game.rerender({ build: emptyToolSnapshot, authored: gameWorld('Wit') });
    game.rerender({ build: sampleToolSnapshot, authored: gameWorld('Grit') });
    expect(ids()).toEqual([]);
    expect(statNames()).toEqual([]);

    editor.unmount();
    // The builders the game holds now, not the ones it mounted with.
    expect(ids()).toContain('wren');
    expect(statNames()).toEqual(['Grit']);
    game.rerender({ build: emptyToolSnapshot, authored: gameWorld('Wit') });
    expect(ids()).toEqual([]);
    expect(statNames()).toEqual(['Wit']);
    game.unmount();
    expect(helpWorld.get()).toBeUndefined();
  });
});
