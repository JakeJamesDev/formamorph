import { describe, it, expect } from 'vitest';
import type { WeatherKind } from '@/types';
import { weatherView, type WeatherViewInput } from './weatherView';
import { isDaylight } from './weather';

const input = (extra: Partial<WeatherViewInput> = {}): WeatherViewInput => ({
  weatherOn: true, worldWeather: 'rain', sheltered: false, daylight: true,
  background: true, foreground: true, reducedMotion: false, previous: undefined, ...extra,
});
const bg = (extra: Partial<WeatherViewInput> = {}) => weatherView(input(extra)).background;

describe('the weather view background', () => {
  it.each(['rain', 'snow', 'storm', 'brightSun'] as const)('draws %s in full', (kind) => {
    expect(bg({ worldWeather: kind })).toEqual({ kind, mode: 'full' });
  });

  it('draws nothing on Clear, or with no World Weather yet', () => {
    expect(bg({ worldWeather: 'clear' })).toEqual({ kind: null, mode: 'none' });
    expect(bg({ worldWeather: undefined })).toEqual({ kind: null, mode: 'none' });
  });

  it('draws nothing in a Sheltered location, whatever the World Weather', () => {
    for (const kind of ['rain', 'snow', 'storm', 'brightSun'] as WeatherKind[]) {
      expect(bg({ worldWeather: kind, sheltered: true })).toEqual({ kind: null, mode: 'none' });
    }
  });

  it('draws nothing with the Weather Background switch off', () => {
    expect(bg({ worldWeather: 'storm', background: false })).toEqual({ kind: null, mode: 'none' });
  });

  it('draws nothing while the world has Weather off', () => {
    expect(bg({ worldWeather: 'snow', weatherOn: false })).toEqual({ kind: null, mode: 'none' });
  });

  it('draws the calm mode under OS reduced motion', () => {
    expect(bg({ worldWeather: 'storm', reducedMotion: true })).toEqual({ kind: 'storm', mode: 'calm' });
    expect(bg({ worldWeather: 'brightSun', reducedMotion: true })).toEqual({ kind: 'brightSun', mode: 'calm' });
  });

  it('draws no Bright Sun outside daylight, but other kinds at night', () => {
    expect(bg({ worldWeather: 'brightSun', daylight: false })).toEqual({ kind: null, mode: 'none' });
    expect(bg({ worldWeather: 'rain', daylight: false })).toEqual({ kind: 'rain', mode: 'full' });
  });

  it('ignores the Weather Foreground switch', () => {
    expect(bg({ worldWeather: 'snow', foreground: false })).toEqual({ kind: 'snow', mode: 'full' });
  });
});

describe('daylight', () => {
  // A story that opens at midnight, so elapsed hours read as the hour of day.
  const at = (hour: number) => isDaylight(hour, { startHour: 0 });

  it('holds in every daypart but night', () => {
    expect(at(3)).toBe(false);
    expect(at(6)).toBe(true);
    expect(at(12)).toBe(true);
    expect(at(19)).toBe(true);
    expect(at(21)).toBe(false);
  });
});
