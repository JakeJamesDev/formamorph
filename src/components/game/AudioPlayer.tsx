import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, Volume1, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";

function fmtTime(s: number): string {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Compact, on-theme player replacing the native <audio controls> so it matches the app's
// Button/Slider styling. `src` is a URL / data URL (e.g. uploaded background music or entity
// sound). `autoPlay` starts playback on mount.
export default function AudioPlayer({ src, autoPlay = false, className }: {
  src?: string;
  autoPlay?: boolean;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const { ttsVolume, setTtsVolume } = useSettings();
  const lastVolRef = useRef(ttsVolume || 1);

  // Keep the element's volume in sync with the persisted setting.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = ttsVolume;
  }, [ttsVolume]);

  const toggleMute = () => {
    if (ttsVolume > 0) {
      lastVolRef.current = ttsVolume;
      setTtsVolume(0);
    } else {
      setTtsVolume(lastVolRef.current || 1);
    }
  };
  const VolumeIcon = ttsVolume === 0 ? VolumeX : ttsVolume < 0.5 ? Volume1 : Volume2;

  const url = src ?? "";

  // Auto-play on mount/new clip when requested (browsers may block; that's fine).
  useEffect(() => {
    if (autoPlay) audioRef.current?.play().catch((e) => console.log("Auto-play prevented:", e));
  }, [url, autoPlay]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const seek = (value: number[]) => {
    const el = audioRef.current;
    if (el) el.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  return (
    <div className={cn("flex h-10 items-center gap-2 w-2/3", className)}>
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={(e) => {
          e.currentTarget.volume = ttsVolume;
          setDuration(e.currentTarget.duration);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <Button variant="ghost" size="icon" onClick={toggle} className="shrink-0">
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Slider
        value={[currentTime]}
        max={duration || 0}
        step={0.1}
        onValueChange={seek}
        className="flex-grow"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
        {fmtTime(currentTime)} / {fmtTime(duration)}
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
