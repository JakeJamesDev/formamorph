import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

export interface TtsPlayback {
  /** Stop any current playback and begin a fresh session (scheduling cursor reset). */
  reset: () => void;
  /** Schedule a PCM chunk to play immediately after the previously queued audio (gapless). */
  enqueue: (data: Float32Array, sampleRate: number) => void;
  pause: () => void;
  resume: () => void;
  /** Stop and discard all scheduled audio. */
  stop: () => void;
  isPlaying: boolean;
  isPaused: boolean;
}

// Web Audio engine for progressive TTS: as each sentence is generated it's scheduled back-to-back
// on a single AudioContext, so narration starts after sentence 1 and plays without gaps. The
// completed clip is handed to the HTML5 AudioPlayer afterward for scrubbing/replay.
export function useTtsPlayback(): TtsPlayback {
  const { ttsVolume } = useSettings();

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nextStartRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activeCountRef = useRef(0);
  const volumeRef = useRef(ttsVolume);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const ensure = useCallback((): { ctx: AudioContext; gain: GainNode } | null => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = volumeRef.current;
      gain.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = gain;
    }
    return { ctx: ctxRef.current, gain: gainRef.current! };
  }, []);

  const stopSources = useCallback(() => {
    sourcesRef.current.forEach((s) => {
      s.onended = null;
      try { s.stop(); } catch { /* already stopped */ }
    });
    sourcesRef.current.clear();
    activeCountRef.current = 0;
  }, []);

  const reset = useCallback(() => {
    const nodes = ensure();
    if (!nodes) return;
    stopSources();
    nodes.ctx.resume().catch(() => {});
    nextStartRef.current = nodes.ctx.currentTime;
    setIsPlaying(false);
    setIsPaused(false);
  }, [ensure, stopSources]);

  const enqueue = useCallback((data: Float32Array, sampleRate: number) => {
    const nodes = ensure();
    if (!nodes) return;
    const { ctx, gain } = nodes;
    ctx.resume().catch(() => {});

    const buffer = ctx.createBuffer(1, data.length, sampleRate);
    buffer.getChannelData(0).set(data);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);

    const startAt = Math.max(ctx.currentTime, nextStartRef.current);
    src.start(startAt);
    nextStartRef.current = startAt + buffer.duration;

    sourcesRef.current.add(src);
    activeCountRef.current += 1;
    setIsPlaying(true);

    src.onended = () => {
      sourcesRef.current.delete(src);
      activeCountRef.current -= 1;
      if (activeCountRef.current <= 0) {
        setIsPlaying(false);
        setIsPaused(false);
      }
    };
  }, [ensure]);

  const pause = useCallback(() => {
    ctxRef.current?.suspend().catch(() => {});
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    ctxRef.current?.resume().catch(() => {});
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    stopSources();
    if (ctxRef.current) nextStartRef.current = ctxRef.current.currentTime;
    setIsPlaying(false);
    setIsPaused(false);
  }, [stopSources]);

  // Keep the master gain in sync with the persisted TTS volume.
  useEffect(() => {
    volumeRef.current = ttsVolume;
    if (gainRef.current) gainRef.current.gain.value = ttsVolume;
  }, [ttsVolume]);

  // Release the AudioContext on unmount.
  useEffect(() => () => { ctxRef.current?.close().catch(() => {}); }, []);

  return { reset, enqueue, pause, resume, stop, isPlaying, isPaused };
}
