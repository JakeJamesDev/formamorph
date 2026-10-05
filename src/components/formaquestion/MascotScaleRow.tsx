import { Row } from '@/components/SettingsRows';
import { Slider } from '@/components/ui/slider';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { MASCOT_SCALE_MAX, MASCOT_SCALE_MIN, type MascotScale } from '@/lib/formaquestion/windowBox';
import { GENERAL_COPY } from './formaquestionSettingsTabs';
import { setMascotScale, useMascotScale } from './useMascotDevice';

const STEP = 5;
/** The slider's leading stop, one step under the smallest percent, stands for Auto. */
const AUTO_STOP = MASCOT_SCALE_MIN - STEP;

const stopOf = (scale: MascotScale): number => (scale === 'auto' ? AUTO_STOP : scale);
const scaleAt = (stop: number): MascotScale => (stop <= AUTO_STOP ? 'auto' : stop);
const labelOf = (scale: MascotScale): string => (scale === 'auto' ? 'Auto' : `${scale}%`);

/** The Mascot Scale row of the General tab: Auto, then a percent of the base's pixel size. It sizes the window's Mascot, on this device. */
export function MascotScaleRow() {
  const scale = useMascotScale();
  const { label, hint } = GENERAL_COPY.mascotScale;
  return (
    <Row htmlFor="fq-mascot-scale" target={targetAttribute('formaquestionSettings.general', 'mascot-scale')} label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <Slider
          id="fq-mascot-scale"
          aria-label={label}
          aria-valuetext={labelOf(scale)}
          className="flex-grow"
          value={[stopOf(scale)]}
          min={AUTO_STOP}
          max={MASCOT_SCALE_MAX}
          step={STEP}
          onValueChange={([stop]) => setMascotScale(scaleAt(stop))}
        />
        <span className="w-24 shrink-0 whitespace-nowrap text-right text-label tabular-nums">{labelOf(scale)}</span>
      </div>
    </Row>
  );
}
