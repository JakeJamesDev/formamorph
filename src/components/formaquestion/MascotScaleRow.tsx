import { Row } from '@/components/SettingsRows';
import { Slider } from '@/components/ui/slider';
import { MASCOT_SCALE_MAX, MASCOT_SCALE_MIN, type MascotScale } from '@/lib/formaquestion/windowBox';
import { MASCOT_COPY } from './formaquestionSettingsTabs';
import { setMascotScale, useMascotScale } from './useMascotScale';

const STEP = 5;
/** The slider's leading stop, one step under the smallest percent, stands for Auto. */
const AUTO_STOP = MASCOT_SCALE_MIN - STEP;

const stopOf = (scale: MascotScale): number => (scale === 'auto' ? AUTO_STOP : scale);
const scaleAt = (stop: number): MascotScale => (stop <= AUTO_STOP ? 'auto' : stop);
const labelOf = (scale: MascotScale): string => (scale === 'auto' ? 'Auto' : `${scale}%`);

/** The Scale slider: Auto, then a percent of the base's pixel size. It sizes the window's Mascot, not the tab preview. */
export function MascotScaleRow() {
  const scale = useMascotScale();
  return (
    <Row {...MASCOT_COPY.scale}>
      <div className="flex items-center gap-3">
        <Slider
          aria-label={MASCOT_COPY.scale.label}
          aria-valuetext={labelOf(scale)}
          value={[stopOf(scale)]}
          min={AUTO_STOP}
          max={MASCOT_SCALE_MAX}
          step={STEP}
          onValueChange={([stop]) => setMascotScale(scaleAt(stop))}
        />
        <span className="w-12 shrink-0 text-right text-label tabular-nums">{labelOf(scale)}</span>
      </div>
    </Row>
  );
}
