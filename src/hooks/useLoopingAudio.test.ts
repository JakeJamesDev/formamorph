// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLoopingAudio } from './useLoopingAudio';

const UNSUPPORTED = Object.assign(new Error('Failed to load because no supported source was found.'), {
  name: 'NotSupportedError',
});

let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;
const rejections: unknown[] = [];
const onRejection = (reason: unknown) => rejections.push(reason);

beforeEach(() => {
  rejections.length = 0;
  process.on('unhandledRejection', onRejection);
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  process.off('unhandledRejection', onRejection);
  vi.restoreAllMocks();
});

/** Lets a rejected promise with no handler reach the process's unhandled-rejection event. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('useLoopingAudio', () => {
  it('loops the source and pauses it on unmount', () => {
    const { unmount } = renderHook(() => useLoopingAudio('data:audio/mpeg;base64,AAAA'));
    const audio = play.mock.contexts[0] as HTMLAudioElement;
    expect(audio.src).toBe('data:audio/mpeg;base64,AAAA');
    expect(audio.loop).toBe(true);
    unmount();
    expect(pause).toHaveBeenCalledOnce();
  });

  it('plays nothing without a source', () => {
    renderHook(() => useLoopingAudio(null));
    renderHook(() => useLoopingAudio(''));
    expect(play).not.toHaveBeenCalled();
  });

  it('swaps the old sound for the new one when the source changes', () => {
    const { rerender } = renderHook(({ src }) => useLoopingAudio(src), { initialProps: { src: 'a.mp3' } });
    rerender({ src: 'b.mp3' });
    expect(pause).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('stays silent when the browser cannot play the source', async () => {
    play.mockRejectedValue(UNSUPPORTED);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderHook(() => useLoopingAudio('data:audio/x-unknown;base64,AAAA'));
    await settle();
    expect(rejections).toEqual([]);
    expect(warn).toHaveBeenCalledWith('Audio did not play:', UNSUPPORTED);
  });
});
