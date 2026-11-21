import { CloudSun, Moon, SunDim, SunMedium, Sunrise, Sunset, type LucideIcon } from 'lucide-react';
import type { Daypart } from '@/types';

/** One icon per daypart, shared by the routine day strip and the Openings Time marker. */
export const DAYPART_ICON: Record<Daypart, LucideIcon> = {
  night: Moon, dawn: Sunrise, morning: SunDim, midday: SunMedium, afternoon: CloudSun, evening: Sunset,
};
