import { KokoroTTS, type GenerateOptions } from "kokoro-js";
import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import VramReadout from "./VramReadout";
import { useVramStats } from "@/lib/useVramStats";
import { useSettings } from "@/contexts/SettingsContext";
import { useGameplay } from "@/contexts/GameplayContext";
import { splitForTTS, splitSentenceSegments, stripMarkdownForSpeech } from "@/lib/ttsChunks";
/** Reports generation progress as `done` of `total` sentence-chunks. */
export type TTSProgress = { done: number; total: number };

// Kokoro-82M at fp32 ≈ 331 MB of weights; WebGPU runtime buffers push the live footprint
// higher, so this is a conservative estimate used only for the pre-load low-VRAM warning.
const KOKORO_VRAM_ESTIMATE_MB = 400;

// A single sentence over this many chars is sub-chunked before synthesis (Kokoro caps ~510 tokens);
// matches splitForTTS's default budget. Narration sentences sit well under it.
const TTS_SENTENCE_MAX_CHARS = 400;

export interface TTSModalHandle {
  // Regenerate audio using the already-loaded model/voice. Pass `text` to override the
  // current game text, and `onProgress` to track per-chunk generation. Returns false if no
  // model is loaded yet (caller can open the modal).
  regenerate: (text?: string, onProgress?: (progress: TTSProgress) => void) => Promise<boolean>;
  // Streaming narration: begin a session, feed sentences as the story streams (synthesized in
  // order, one at a time), then end (flush + finalize) or cancel (discard).
  streamStart: () => void;
  streamSentence: (text: string) => void;
  streamEnd: () => void;
  streamCancel: () => void;
}

const TTSModal = forwardRef<TTSModalHandle, {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  narration?: string;
  onLoadedChange?: (loaded: boolean) => void;
}>(function TTSModal({ isOpen, onOpenChange, narration = "Hello World", onLoadedChange }, ref) {
  const [isLoading, setIsLoading] = useState(false);
  const [tts, setTTS] = useState<KokoroTTS | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [webGPUSupported, setWebGPUSupported] = useState(false);
  const {
    vramHelperUrl,
    ttsSpeed,
    setTtsSpeed,
    streamNarrationAudio,
    setStreamNarrationAudio,
    ttsHighlight,
    setTtsHighlight,
  } = useSettings();
  const { ttsPlayback } = useGameplay();
  const vramStats = useVramStats(vramHelperUrl, { enabled: isOpen });
  const [freeBeforeLoad, setFreeBeforeLoad] = useState<number | null>(null);
  const [isUnloading, setIsUnloading] = useState(false);
  const [genProgress, setGenProgress] = useState<TTSProgress | null>(null);

  // Streaming-narration queue: sentences are synthesized one at a time, in order, as the story
  // streams. Refs (not state) so the caller can push without re-rendering; ttsRef/voiceRef keep the
  // sequential drainer reading the current model/voice without stale closures.
  const streamQueueRef = useRef<string[]>([]);
  const streamDrainingRef = useRef(false);
  const streamEndedRef = useRef(false);
  const streamSentenceIndexRef = useRef(0); // sequential sentence index for the karaoke highlighter
  const ttsRef = useRef(tts);
  const voiceRef = useRef(selectedVoice);
  const speedRef = useRef(ttsSpeed);
  useEffect(() => { ttsRef.current = tts; }, [tts]);
  useEffect(() => { voiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { speedRef.current = ttsSpeed; }, [ttsSpeed]);

  // Release the ONNX sessions (frees the WebGPU/VRAM allocation) and return to the load screen.
  const unloadModel = async () => {
    if (!tts) return;
    try {
      setIsUnloading(true);
      await tts.model.dispose();
    } catch (error) {
      console.error("Failed to unload TTS model:", error);
    } finally {
      setTTS(null);
      setFreeBeforeLoad(null);
      setIsUnloading(false);
    }
  };

  // Min free VRAM across GPUs while the helper is online; null otherwise.
  const minFreeMB =
    vramStats.status === "online"
      ? vramStats.gpus.reduce<number | null>((min, g) => {
          if (g.freeMB == null) return min;
          return min == null ? g.freeMB : Math.min(min, g.freeMB);
        }, null)
      : null;
  const lowVram = minFreeMB != null && minFreeMB < KOKORO_VRAM_ESTIMATE_MB;
  // Once loaded, the drop in free VRAM is Kokoro's actual usage (best-effort).
  const actualUsedMB =
    tts && freeBeforeLoad != null && minFreeMB != null && freeBeforeLoad - minFreeMB > 0
      ? freeBeforeLoad - minFreeMB
      : null;

  // The single point all TTS text passes through on its way to the engine. Strip Markdown here so Kokoro
  // speaks the words, not the syntax (e.g. a stray "*" read aloud as "asterisk").
  const synthesizeSpeech = useCallback(
    (model: KokoroTTS, text: string, voice: string, speed: number) =>
      model.generate(stripMarkdownForSpeech(text), { voice: voice as GenerateOptions['voice'], speed }),
    [],
  );

  // Generate audio for `text` with the loaded model/voice; returns false if not ready.
  // One audio unit per sentence so the karaoke highlighter can map the playhead to a sentence; an
  // over-long sentence (past Kokoro's ~510-token cap) is sub-chunked but keeps a single sentenceIndex.
  const generateAudio = useCallback(async (
    text: string,
    onProgress?: (progress: TTSProgress) => void,
  ): Promise<boolean> => {
    if (!tts || !selectedVoice) return false;
    try {
      setIsPlaying(true);
      // Strip before splitting so sentence boundaries + budgets are measured on the spoken words.
      const sentences = splitSentenceSegments(stripMarkdownForSpeech(text))
        .map((s) => s.trim())
        .filter(Boolean);
      const units = sentences.flatMap((sentence, sentenceIndex) =>
        (sentence.length <= TTS_SENTENCE_MAX_CHARS ? [sentence] : splitForTTS(sentence))
          .map((audioText) => ({ audioText, sentenceIndex, sentenceText: sentence })),
      );
      const total = units.length;
      if (total === 0) return false;

      // Start a fresh playback session; each unit plays the moment it's ready (gapless).
      ttsPlayback.reset();
      for (let i = 0; i < total; i++) {
        onProgress?.({ done: i, total });
        const unit = units[i];
        const result = await synthesizeSpeech(tts, unit.audioText, selectedVoice, ttsSpeed);
        ttsPlayback.append(new Float32Array(result.audio), result.sampling_rate, {
          sentenceIndex: unit.sentenceIndex,
          text: unit.sentenceText,
        });
      }
      ttsPlayback.finalize();
      onProgress?.({ done: total, total });
      return true;
    } catch (error) {
      console.error("Failed to generate or play audio:", error);
      return false;
    } finally {
      setIsPlaying(false);
    }
  }, [tts, selectedVoice, ttsSpeed, ttsPlayback, synthesizeSpeech]);

  // Synthesize queued sentences sequentially, appending each to the playback engine; finalize once
  // the stream has ended and the queue is drained.
  const drainStream = useCallback(async () => {
    if (streamDrainingRef.current) return;
    streamDrainingRef.current = true;
    try {
      while (streamQueueRef.current.length > 0) {
        const text = streamQueueRef.current.shift()!;
        const model = ttsRef.current;
        const voice = voiceRef.current;
        if (!model || !voice) continue;
        const sentenceIndex = streamSentenceIndexRef.current++;
        try {
          const result = await synthesizeSpeech(model, text, voice, speedRef.current);
          ttsPlayback.append(new Float32Array(result.audio), result.sampling_rate, {
            sentenceIndex,
            text: stripMarkdownForSpeech(text),
          });
        } catch (error) {
          console.error("Failed to synthesize narration sentence:", error);
        }
      }
    } finally {
      streamDrainingRef.current = false;
    }
    if (streamEndedRef.current && streamQueueRef.current.length === 0) {
      ttsPlayback.finalize();
    }
  }, [ttsPlayback, synthesizeSpeech]);

  const streamStart = useCallback(() => {
    streamQueueRef.current = [];
    streamEndedRef.current = false;
    streamDrainingRef.current = false;
    streamSentenceIndexRef.current = 0;
    ttsPlayback.reset();
  }, [ttsPlayback]);

  const streamSentence = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    streamQueueRef.current.push(trimmed);
    drainStream();
  }, [drainStream]);

  const streamEnd = useCallback(() => {
    streamEndedRef.current = true;
    drainStream();
  }, [drainStream]);

  const streamCancel = useCallback(() => {
    streamQueueRef.current = [];
    streamEndedRef.current = false;
    streamSentenceIndexRef.current = 0;
    ttsPlayback.reset();
  }, [ttsPlayback]);

  useImperativeHandle(ref, () => ({
    regenerate: (text?: string, onProgress?: (progress: TTSProgress) => void) =>
      generateAudio(text ?? narration, onProgress),
    streamStart,
    streamSentence,
    streamEnd,
    streamCancel,
  }), [generateAudio, narration, streamStart, streamSentence, streamEnd, streamCancel]);

  // Report load/unload so the parent can gate the regenerate button and auto-generation.
  useEffect(() => {
    onLoadedChange?.(!!tts);
  }, [tts, onLoadedChange]);

  useEffect(() => {
    // Check for WebGPU support
    const checkWebGPU = async () => {
      try {
        const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
        if (!gpu) {
          setWebGPUSupported(false);
          return;
        }
        const adapter = await gpu.requestAdapter();
        setWebGPUSupported(!!adapter);
      } catch (error) {
        console.error("WebGPU check failed:", error);
        setWebGPUSupported(false);
      }
    };
    checkWebGPU();
  }, []);

  useEffect(() => {
    if (tts) {
      // Voice data is available directly from the model
      const voiceList = [
        "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica",
        "af_kore", "af_nicole", "af_nova", "af_river", "af_sarah",
        "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir",
        "am_liam", "am_michael", "am_onyx", "am_puck", "am_santa",
        "bf_emma", "bf_isabella", "bm_george", "bm_lewis", "bf_alice",
        "bf_lily", "bm_daniel", "bm_fable"
      ];
      setVoices(voiceList);
      setSelectedVoice(voiceList[0]); // Default to first voice
    }
  }, [tts]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Text to Speech</DialogTitle>
          <DialogDescription>
            Model: KokoroTTS v2
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-4">
            <IndeterminateProgress />
          </div>
        ) : tts ? (
          <div className="py-4 space-y-4">
            {actualUsedMB != null && (
              <p className="text-xs text-muted-foreground">
                Kokoro is using ~{actualUsedMB} MB of VRAM.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium mb-2">Voice Selection</label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a voice" />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((voice) => (
                    <SelectItem key={voice} value={voice}>
                      {voice.replace(/_/g, ' ').replace(/^[ab][fm]_/, '')} ({voice.startsWith('af_') ? 'Female US' :
                        voice.startsWith('am_') ? 'Male US' :
                        voice.startsWith('bf_') ? 'Female UK' : 'Male UK'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium flex items-center justify-between">
                <span>Speed</span>
                <span className="text-muted-foreground tabular-nums">{ttsSpeed.toFixed(1)}×</span>
              </label>
              <Slider
                value={[ttsSpeed]}
                min={0.5}
                max={2}
                step={0.1}
                onValueChange={(v) => setTtsSpeed(v[0])}
              />
              <p className="text-xs text-muted-foreground">
                Applies to newly generated audio — use the regenerate button (↻) to re-speak the current text.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="streamNarrationAudio"
                checked={streamNarrationAudio}
                onCheckedChange={(c) => setStreamNarrationAudio(c === true)}
                className="mt-0.5 shrink-0"
              />
              <label htmlFor="streamNarrationAudio" className="text-xs text-muted-foreground leading-4">
                <span className="font-medium text-foreground">Stream narration audio.</span> Start speaking each
                sentence as soon as it finishes streaming, instead of after the whole story. Lower latency, but TTS
                runs alongside the model — may compete for the GPU if your LLM is on the same machine.
              </label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="ttsHighlight"
                checked={ttsHighlight}
                onCheckedChange={(c) => setTtsHighlight(c === true)}
                className="mt-0.5 shrink-0"
              />
              <label htmlFor="ttsHighlight" className="text-xs text-muted-foreground leading-4">
                <span className="font-medium text-foreground">Highlight while speaking.</span> Highlight the
                sentence being narrated and follow the playhead when you scrub. Falls back gracefully on browsers
                without highlight support.
              </label>
            </div>
            <Button
            className='w-full'
              onClick={async () => {
                setGenProgress({ done: 0, total: 1 });
                const ok = await generateAudio(narration, setGenProgress);
                setGenProgress(null);
                if (ok) onOpenChange(false);
              }}
              disabled={isPlaying || isUnloading}
            >
              {isPlaying ? "Generating..." : "Start"}
            </Button>
            {isPlaying && genProgress && (
              <div className="space-y-1">
                <Progress value={(genProgress.done / genProgress.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Generating sentence {Math.min(genProgress.done + 1, genProgress.total)} of {genProgress.total}…
                </p>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={unloadModel}
              disabled={isPlaying || isUnloading}
            >
              {isUnloading ? "Unloading..." : "Unload Model"}
            </Button>
          </div>
        ) : null}
        {!tts && (
          <DialogFooter>
            <div className="space-y-4 w-full">
              <VramReadout stats={vramStats} compact />
              {!webGPUSupported && (
                <div className="text-sm text-red-500">
                  WebGPU is not supported in your browser. Please use a WebGPU-enabled browser like Chrome Canary or Edge Canary.
                </div>
              )}
              {lowVram && (
                <div className="text-sm text-red-500 whitespace-nowrap">
                  Low VRAM: ~{KOKORO_VRAM_ESTIMATE_MB} MB needed, only {minFreeMB} MB free — loading may fail or fall back to CPU.
                </div>
              )}
              <Button
                onClick={async () => {
                  try {
                    setFreeBeforeLoad(minFreeMB);
                    setIsLoading(true);
                    const model = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
                      dtype: "fp32",
                      device: "webgpu"
                    });
                    setTTS(model);
                    setIsLoading(false);
                  } catch (error) {
                    console.error("Failed to load TTS model:", error);
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading || !webGPUSupported}
              >
                Load Model
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
});

export default TTSModal;
