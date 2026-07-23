import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useGameplay } from "@/contexts/GameplayContext";
import { cn, formatMMSS } from "@/lib/utils";
import { useVolumeMute } from "@/lib/useVolumeMute";

// Seek-bar widget bound to the Web Audio TTS engine (not an <audio> element), so the same engine
// that streams sentences as they generate also drives play/pause and scrubbing — no hand-off.
export default function TtsPlaybackBar({ className }: { className?: string }) {
  const { ttsPlayback } = useGameplay();
  const { ttsVolume, setTtsVolume, toggleMute, VolumeIcon } = useVolumeMute();
  const { position, duration, paused, togglePlay, seek } = ttsPlayback;

  return (
    <div className={cn("flex h-10 items-center gap-2 w-2/3", className)}>
      <Button variant="ghost" size="icon" onClick={togglePlay} className="shrink-0">
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>
      <Slider
        value={[Math.min(position, duration)]}
        max={duration || 0}
        step={0.1}
        onValueChange={(v) => seek(v[0])}
        className="flex-grow"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
        {formatMMSS(position)} / {formatMMSS(duration)}
      </span>
      <Button variant="ghost" size="icon" onClick={toggleMute} className="shrink-0" title="Mute / unmute">
        <VolumeIcon className="h-4 w-4" />
      </Button>
      <Slider
        value={[ttsVolume]}
        max={1}
        step={0.05}
        onValueChange={(v) => setTtsVolume(v[0])}
        className="w-16 shrink-0"
      />
    </div>
  );
}
