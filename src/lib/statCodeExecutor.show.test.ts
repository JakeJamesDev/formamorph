/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engines loading through their filesystem paths.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode, type SandboxMedia } from './statCodeExecutor';
import { silentPrompts, type ScriptPromptHost, type ScriptPromptRequest } from './scriptPrompts';
import { tellHost, type ScriptTell } from './scriptTells';
import type { ScriptTiming, Stat } from '@/types';

const health: Stat = { id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [] };

const media: SandboxMedia = {
  entries: [
    { id: 'm-harbor', name: 'Harbor', kind: 'image' },
    { id: 'm-gull', name: 'Gull', kind: 'image' },
    { id: 'm-bell', name: 'Bell', kind: 'sound' },
  ],
  overrides: {},
  defaults: () => ({}),
};

/** A play run at `timing`: what the play host records for each tell and show. */
async function play(code: string, timing: ScriptTiming) {
  const recorded: ScriptTell[] = [];
  const result = await executeStatCode(code, [health], null, { media, prompts: tellHost(silentPrompts, timing, (tell) => recorded.push(tell), () => {}) });
  return { result, recorded };
}

/** Every request the run sent the host. With `self`, the run is the stat's own, so its return value reads back. */
async function asked(code: string, self: Stat | null = null) {
  const requests: ScriptPromptRequest[] = [];
  const prompts: ScriptPromptHost = { prompt: (request) => { requests.push(request); return Promise.resolve(undefined as never); } };
  const result = await executeStatCode(code, [health], self, { media, prompts });
  return { result, requests };
}

describe('player.show', () => {
  let errors: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { errors = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => errors.mockRestore());

  it.each(['start', 'before', 'after'] as const)('records a medium block image by media id in %s', async (timing) => {
    const { result, recorded } = await play('player.show("Harbor");', timing);
    expect(result.error).toBeNull();
    expect(recorded).toEqual([{ image: 'm-harbor', size: 'medium', wrap: 'block', timing }]);
  });

  it('keeps call order with tells, and records the size', async () => {
    const { recorded } = await play('player.show("Gull", { size: "small" }); player.tell("A gull."); player.show("Harbor", { size: "large" });', 'after');
    expect(recorded).toEqual([
      { image: 'm-gull', size: 'small', wrap: 'block', timing: 'after' },
      { text: 'A gull.', timing: 'after' },
      { image: 'm-harbor', size: 'large', wrap: 'block', timing: 'after' },
    ]);
  });

  it('sends the name and the wrap the call gave, and the play host stores a block', async () => {
    const { requests } = await asked('player.show("Gull", { wrap: "left", extra: 1 });');
    expect(requests).toEqual([{ kind: 'show', name: 'Gull', mediaId: 'm-gull', size: 'medium', wrap: 'left' }]);
    const { recorded } = await play('player.show("Gull", { wrap: "left" });', 'before');
    expect(recorded).toEqual([{ image: 'm-gull', size: 'medium', wrap: 'block', timing: 'before' }]);
  });

  it.each([
    ['an unknown name', 'player.show("Lighthouse");', 'The world has no image named "Lighthouse"'],
    ['a sound’s name', 'player.show("Bell");', 'The world has no image named "Bell"'],
    ['a bad size', 'player.show("Harbor", { size: "huge" });', 'player.show size must be "small", "medium", "large", not "huge"'],
    ['a bad wrap', 'player.show("Harbor", { wrap: "diagonal" });', 'player.show wrap must be "block", "left", "right", not "diagonal"'],
  ])('fails the script on %s, naming it, even when caught', async (_case, call, message) => {
    for (const code of [call, `try { ${call} } catch (error) {}`]) {
      const { result, requests } = await asked(code);
      expect(result.error).toContain(message);
      expect(requests).toEqual([]);
    }
  });

  it.each([
    ['a name that is not text', 'player.show(3);', 'player.show needs an image name as text'],
    ['options that are not an object', 'player.show("Harbor", "large");', 'player.show options must be an object'],
  ])('throws a TypeError on %s', async (_case, code, message) => {
    const { result } = await asked(code);
    expect(result.error).toContain(message);
    const caught = await asked(`try { ${code} } catch (e) { return e instanceof TypeError ? 1 : 0; } return 0;`, health);
    expect(caught.result).toMatchObject({ value: 1, error: null });
  });
});
