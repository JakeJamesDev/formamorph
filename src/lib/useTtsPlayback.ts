import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

export interface TtsPlayback {
  /** Stop playback and begin a fresh session (clears the clip). */
  reset: () => void;
  /** Append a generated sentence; plays immediately (gapless) and grows the clip's duration. */
  append: (data: Float32Array, sampleRate: number) => void;
  /** Mark generation complete so reaching the end is treated as "ended" (not an underrun wait). */
  finalize: () => void;
  /** Play/pause toggle; replays from the start when called after the clip ended. */
  togglePlay: () => void;
  /** Seek to `seconds` within the generated audio. */
  seek: (seconds: number) => void;
  position: number;
  duration: number;
  paused: boolean;
  ended: boolean;
}

interface Chunk { data: Float32Array; sampleRate: number; start: number; duration: number }

// Single Web Audio engine that both plays progressive TTS (sentences scheduled gaplessly as they
// generate) AND backs the seek-bar widget — so there's no hand-off between a streaming player and a
// finished clip. Sentences accumulate into `chunksRef`, which lets us reschedule from any position
// for seek/replay. Position is derived from the AudioContext clock while playing.
export function useTtsPlayback(): TtsPlayback {
  const { ttsVolume } = useSettings();

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const chunksRef = useRef<Chunk[]>([]);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activeRef = useRef(0);
  const startTimeRef = useRef(0);      // ctx time mapped to playback position 0
  const totalRef = useRef(0);          // total generated duration (s)
  const pausedPosRef = useRef(0);      // frozen position while paused/ended
  const generatingRef = useRef(false); // chunks may still be arriving
  const userPausedRef = useRef(false);
  const volumeRef = useRef(ttsVolume);

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [ended, setEnded] = useState(false);

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

  const currentPos = useCallback((): number => {
    const ctx = ctxRef.current;
    if (paused || !ctx) return pausedPosRef.current;
    return Math.min(Math.max(ctx.currentTime - startTimeRef.current, 0), totalRef.current);
  }, [paused]);

  const stopSources = useCallback(() => {
    sourcesRef.current.forEach((s) => {
      s.onended = null;
      try { s.stop(); } catch { /* already stopped */ }
    });
    sourcesRef.current.clear();
    activeRef.current = 0;
  }, []);

  // Schedule one chunk to start at ctx-time `at`, skipping `skip` seconds into it.
  const scheduleChunk = useCallback((ctx: AudioContext, gain: GainNode, chunk: Chunk, at: number, skip = 0) => {
    const skipSamples = Math.floor(skip * chunk.sampleRate);
    const slice = skipSamples > 0 ? chunk.data.subarray(skipSamples) : chunk.data;
    if (slice.length === 0) return;
    const buffer = ctx.createBuffer(1, slice.length, chunk.sampleRate);
    buffer.getChannelData(0).set(slice);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    src.start(Math.max(ctx.currentTime, at));
    sourcesRef.current.add(src);
    activeRef.current += 1;
    src.onended = () => {
      sourcesRef.current.delete(src);
      activeRef.current -= 1;
      if (activeRef.current <= 0) {
        if (generatingRef.current || userPausedRef.current) return; // underrun: next chunk continues
        pausedPosRef.current = totalRef.current;
        setPosition(totalRef.current);
        setPaused(true);
        setEnded(true);
      }
    };
  }, []);

  // Restart playback from position `from`, scheduling every still-upcoming chunk.
  const playFrom = useCallback((from: number) => {
    const nodes = ensure();
    if (!nodes) return;
    const { ctx, gain } = nodes;
    ctx.resume().catch(() => {});
    stopSources();
    startTimeRef.current = ctx.currentTime - from;
    for (const chunk of chunksRef.current) {
      const end = chunk.start + chunk.duration;
      if (end <= from) continue;
      const skip = from > chunk.start ? from - chunk.start : 0;
      scheduleChunk(ctx, gain, chunk, startTimeRef.current + chunk.start + skip, skip);
    }
    setEnded(false);
    setPaused(false);
  }, [ensure, stopSources, scheduleChunk]);

  const reset = useCallback(() => {
    stopSources();
    chunksRef.current = [];
    totalRef.current = 0;
    pausedPosRef.current = 0;
    startTimeRef.current = 0;
    generatingRef.current = true;
    userPausedRef.current = false;
    setDuration(0);
    setPosition(0);
    setPaused(true);
    setEnded(false);
  }, [stopSources]);

  const append = useCallback((data: Float32Array, sampleRate: number) => {
    const nodes = ensure();
    if (!nodes) return;
    const { ctx, gain } = nodes;
    const start = totalRef.current;
    const dur = data.length / sampleRate;
    const chunk: Chunk = { data, sampleRate, start, duration: dur };
    chunksRef.current.push(chunk);
    totalRef.current = start + dur;
    setDuration(totalRef.current);

    if (userPausedRef.current) return; // honor an explicit pause; the chunk waits in the buffer

    ctx.resume().catch(() => {});
    if (activeRef.current === 0 && pausedPosRef.current <= start) {
      // First chunk of a run (or resuming after a brief underrun): anchor position 0 to now.
      startTimeRef.current = ctx.currentTime - start;
    }
    scheduleChunk(ctx, gain, chunk, startTimeRef.current + start);
    setPaused(false);
    setEnded(false);
  }, [ensure, scheduleChunk]);

  const finalize = useCallback(() => {
    generatingRef.current = false;
    if (activeRef.current === 0 && !userPausedRef.current) {
      pausedPosRef.current = totalRef.current;
      setPosition(totalRef.current);
      setPaused(true);
      setEnded(true);
    }
  }, []);

  const pause = useCallback(() => {
    pausedPosRef.current = currentPos();
    userPausedRef.current = true;
    stopSources();
    setPosition(pausedPosRef.current);
    setPaused(true);
  }, [currentPos, stopSources]);

  const play = useCallback(() => {
    userPausedRef.current = false;
    playFrom(ended ? 0 : pausedPosRef.current);
  }, [ended, playFrom]);

  const togglePlay = useCallback(() => { (paused ? play : pause)(); }, [paused, play, pause]);

  const seek = useCallback((seconds: number) => {
    const t = Math.min(Math.max(seconds, 0), totalRef.current);
    if (paused) {
      pausedPosRef.current = t;
      setPosition(t);
    } else {
      playFrom(t);
    }
  }, [paused, playFrom]);

  // Drive the position readout from the AudioContext clock while playing.
  useEffect(() => {
    if (paused || duration === 0) return;
    let raf = 0;
    const tick = () => { setPosition(currentPos()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, duration, currentPos]);

  // Keep the master gain in sync with the persisted TTS volume.
  useEffect(() => {
    volumeRef.current = ttsVolume;
    if (gainRef.current) gainRef.current.gain.value = ttsVolume;
  }, [ttsVolume]);

  // Release the AudioContext on unmount.
  useEffect(() => () => { ctxRef.current?.close().catch(() => {}); }, []);

  return { reset, append, finalize, togglePlay, seek, position, duration, paused, ended };
}
