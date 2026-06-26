import { Play, Pause, Volume2, Volume1, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSettings } from "@/contexts/SettingsContext";
import { useGameplay } from "@/contexts/GameplayContext";
import { useRef } from "react";
import { cn } from "@/lib/utils";

function fmtTime(s: number): string {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Seek-bar widget bound to the Web Audio TTS engine (not an <audio> element), so the same engine
// that streams sentences as they generate also drives play/pause and scrubbing — no hand-off.
export default function TtsPlaybackBar({ className }: { className?: string }) {
  const { ttsPlayback } = useGameplay();
  const { ttsVolume, setTtsVolume } = useSettings();
  const lastVolRef = useRef(ttsVolume || 1);
  const { position, duration, paused, togglePlay, seek } = ttsPlayback;

  const toggleMute = () => {
    if (ttsVolume > 0) {
      lastVolRef.current = ttsVolume;
      setTtsVolume(0);
    } else {
      setTtsVolume(lastVolRef.current || 1);
    }
  };
  const VolumeIcon = ttsVolume === 0 ? VolumeX : ttsVolume < 0.5 ? Volume1 : Volume2;

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
        {fmtTime(position)} / {fmtTime(duration)}
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
