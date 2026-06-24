import { KokoroTTS, type GenerateOptions } from "kokoro-js";
import { useState, useEffect } from "react";
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
import VramReadout from "./VramReadout";
import { useVramStats } from "@/lib/useVramStats";
import { useSettings } from "@/contexts/SettingsContext";
import type { TTSAudio } from "@/types";

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

export default function TTSModal({ isOpen, onOpenChange, gameText = "Hello World", onTTSGenerated }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  gameText?: string;
  onTTSGenerated: (audioData: TTSAudio) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [tts, setTTS] = useState<KokoroTTS | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [webGPUSupported, setWebGPUSupported] = useState(false);
  const { vramHelperUrl } = useSettings();
  const vramStats = useVramStats(vramHelperUrl, { enabled: isOpen });
  const [freeBeforeLoad, setFreeBeforeLoad] = useState<number | null>(null);
  const [isUnloading, setIsUnloading] = useState(false);

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
                try {
                  setIsPlaying(true);
                  const result = await tts.generate(gameText, {
                    voice: selectedVoice as GenerateOptions['voice'],
                  });

                  // Create a Float32Array from the audio data
                  const audioArray = new Float32Array(result.audio);

                  // Create a WAV file with the correct format
                  const wavData = createWAV(audioArray, result.sampling_rate);

                  // Create audio data object with WAV buffer
                  const audioData = {
                    audio: wavData,
                    samplingRate: result.sampling_rate
                  };

                  // Call the callback with the WAV audio data
                  onTTSGenerated(audioData);
                  setIsPlaying(false);
                  onOpenChange(false);
                } catch (error) {
                  console.error("Failed to generate or play audio:", error);
                  setIsPlaying(false);
                }
              }}
              disabled={isPlaying || isUnloading}
            >
              {isPlaying ? "Generating..." : "Start"}
            </Button>
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
}
