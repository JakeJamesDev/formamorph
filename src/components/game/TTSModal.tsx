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
import VramReadout from "./VramReadout";
import { useVramStats } from "@/lib/useVramStats";
import { useSettings } from "@/contexts/SettingsContext";
import { useGameplay } from "@/contexts/GameplayContext";
import { splitForTTS } from "@/lib/ttsChunks";
import type { TTSAudio } from "@/types";

/** Reports generation progress as `done` of `total` sentence-chunks. */
export type TTSProgress = { done: number; total: number };

// Kokoro-82M at fp32 ≈ 331 MB of weights; WebGPU runtime buffers push the live footprint
// higher, so this is a conservative estimate used only for the pre-load low-VRAM warning.
const KOKORO_VRAM_ESTIMATE_MB = 400;

// Function to create a WAV file from audio data
function createWAV(audioData: Float32Array, sampleRate: number) {
  const numChannels = 1; // Mono audio
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;

  // Convert Float32Array to Int16Array
  const samples = new Int16Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // Create the WAV header
  const headerLength = 44;
  const dataLength = samples.length * bytesPerSample;
  const fileLength = headerLength + dataLength;
  const header = new ArrayBuffer(headerLength);
  const view = new DataView(header);

  // RIFF chunk descriptor
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  view.setUint32(4, fileLength - 8, true);
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));

  // fmt sub-chunk
  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  view.setUint32(40, dataLength, true);

  // Combine header and audio data
  const wavBuffer = new Uint8Array(fileLength);
  wavBuffer.set(new Uint8Array(header));
  wavBuffer.set(new Uint8Array(samples.buffer), headerLength);

  return wavBuffer;
}

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
  gameText?: string;
  onTTSGenerated: (audioData: TTSAudio) => void;
  onLoadedChange?: (loaded: boolean) => void;
}>(function TTSModal({ isOpen, onOpenChange, gameText = "Hello World", onTTSGenerated, onLoadedChange }, ref) {
  const [isLoading, setIsLoading] = useState(false);
  const [tts, setTTS] = useState<KokoroTTS | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [webGPUSupported, setWebGPUSupported] = useState(false);
  const { vramHelperUrl } = useSettings();
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
  const ttsRef = useRef(tts);
  const voiceRef = useRef(selectedVoice);
  useEffect(() => { ttsRef.current = tts; }, [tts]);
  useEffect(() => { voiceRef.current = selectedVoice; }, [selectedVoice]);

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

  // Generate audio for `text` with the loaded model/voice; returns false if not ready.
  // Kokoro truncates each generate() past ~510 tokens, so the text is split into sentence-chunks
  // and generated one at a time (reporting progress), then concatenated into a single WAV.
  const generateAudio = useCallback(async (
    text: string,
    onProgress?: (progress: TTSProgress) => void,
  ): Promise<boolean> => {
    if (!tts || !selectedVoice) return false;
    try {
      setIsPlaying(true);
      const chunks = splitForTTS(text);
      const total = chunks.length;
      if (total === 0) return false;

      // Start a fresh playback session; each chunk plays the moment it's ready (gapless).
      ttsPlayback.reset();
      const parts: Float32Array[] = [];
      let samplingRate = 24000;
      for (let i = 0; i < total; i++) {
        onProgress?.({ done: i, total });
        const result = await tts.generate(chunks[i], { voice: selectedVoice as GenerateOptions['voice'] });
        const data = new Float32Array(result.audio);
        parts.push(data);
        samplingRate = result.sampling_rate;
        ttsPlayback.append(data, samplingRate);
      }
      ttsPlayback.finalize();
      onProgress?.({ done: total, total });

      const merged = new Float32Array(parts.reduce((sum, p) => sum + p.length, 0));
      let offset = 0;
      for (const p of parts) { merged.set(p, offset); offset += p.length; }

      const wavData = createWAV(merged, samplingRate);
      onTTSGenerated({ audio: wavData, samplingRate });
      return true;
    } catch (error) {
      console.error("Failed to generate or play audio:", error);
      return false;
    } finally {
      setIsPlaying(false);
    }
  }, [tts, selectedVoice, onTTSGenerated, ttsPlayback]);

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
        try {
          const result = await model.generate(text, { voice: voice as GenerateOptions['voice'] });
          ttsPlayback.append(new Float32Array(result.audio), result.sampling_rate);
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
  }, [ttsPlayback]);

  const streamStart = useCallback(() => {
    streamQueueRef.current = [];
    streamEndedRef.current = false;
    streamDrainingRef.current = false;
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
    ttsPlayback.reset();
  }, [ttsPlayback]);

  useImperativeHandle(ref, () => ({
    regenerate: (text?: string, onProgress?: (progress: TTSProgress) => void) =>
      generateAudio(text ?? gameText, onProgress),
    streamStart,
    streamSentence,
    streamEnd,
    streamCancel,
  }), [generateAudio, gameText, streamStart, streamSentence, streamEnd, streamCancel]);

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
            <Button
            className='w-full'
              onClick={async () => {
                setGenProgress({ done: 0, total: 1 });
                const ok = await generateAudio(gameText, setGenProgress);
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
