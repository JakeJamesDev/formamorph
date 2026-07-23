import { useRef } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';

/** Shared volume/mute controls for the audio players. Toggling mute remembers the pre-mute level so
 *  unmuting restores it, and `VolumeIcon` reflects the current level. */
export function useVolumeMute() {
  const { ttsVolume, setTtsVolume } = useSettings();
  const lastVolRef = useRef(ttsVolume || 1);

  const toggleMute = () => {
    if (ttsVolume > 0) {
      lastVolRef.current = ttsVolume;
      setTtsVolume(0);
    } else {
      setTtsVolume(lastVolRef.current || 1);
    }
  };
  const VolumeIcon = ttsVolume === 0 ? VolumeX : ttsVolume < 0.5 ? Volume1 : Volume2;

  return { ttsVolume, setTtsVolume, toggleMute, VolumeIcon };
}
