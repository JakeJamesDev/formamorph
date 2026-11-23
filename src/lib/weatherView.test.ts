import { describe, it, expect } from 'vitest';
import type { WeatherKind } from '@/types';
import { weatherView, type WeatherViewInput } from './weatherView';
import { isDaylight } from './weather';

const input = (extra: Partial<WeatherViewInput> = {}): WeatherViewInput => ({
  weatherOn: true, worldWeather: 'rain', sheltered: false, locationArt: true, mask: undefined, daylight: true,
  background: true, foreground: true, reducedMotion: false, change: null, ...extra,
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

describe('the weather view background under a Weather Mask', () => {
  const MASK = 'data:image/png;base64,window';

  it('draws an open location unmasked when its image has no mask', () => {
    expect(bg({ mask: undefined })).toEqual({ kind: 'rain', mode: 'full' });
  });

  it('limits an open location to its mask', () => {
    expect(bg({ mask: MASK })).toEqual({ kind: 'rain', mode: 'full', mask: MASK });
  });

  it('shows a Sheltered location through its mask, and hides it without one', () => {
    expect(bg({ sheltered: true, mask: MASK })).toEqual({ kind: 'rain', mode: 'full', mask: MASK });
    expect(bg({ sheltered: true, mask: undefined })).toEqual({ kind: null, mode: 'none' });
  });

  it('ignores the mask with no location art behind the weather', () => {
    expect(bg({ locationArt: false, mask: MASK })).toEqual({ kind: 'rain', mode: 'full' });
    expect(bg({ locationArt: false, sheltered: true, mask: MASK })).toEqual({ kind: null, mode: 'none' });
  });

  it('draws nothing on Clear, or for Bright Sun after dark, mask or not', () => {
    expect(bg({ worldWeather: 'clear', sheltered: true, mask: MASK })).toEqual({ kind: null, mode: 'none' });
    expect(bg({ worldWeather: 'brightSun', daylight: false, mask: MASK })).toEqual({ kind: null, mode: 'none' });
  });

  it('draws nothing with the Weather Background switch off, mask or not', () => {
    expect(bg({ background: false, sheltered: true, mask: MASK })).toEqual({ kind: null, mode: 'none' });
  });

  it('draws the masked calm mode under OS reduced motion', () => {
    expect(bg({ reducedMotion: true, sheltered: true, mask: MASK })).toEqual({ kind: 'rain', mode: 'calm', mask: MASK });
  });

  it('leaves the Weather Foreground hidden in a masked Sheltered location', () => {
    expect(weatherView(input({ sheltered: true, mask: MASK, change: { to: 'rain', foreground: true } })).foreground).toBeNull();
  });
});

describe('the weather view foreground', () => {
  const fg = (extra: Partial<WeatherViewInput> = {}) => weatherView(input(extra)).foreground;
  const into = (to: WeatherKind | null, foreground = true) => ({ change: { to, foreground } });

  it.each(['rain', 'snow', 'storm', 'brightSun'] as const)('plays %s on a change into it', (kind) => {
    expect(fg({ worldWeather: kind, ...into(kind) })).toBe(kind);
  });

  it('plays nothing on load, New Game, a redraw or paging', () => {
    expect(fg({ worldWeather: 'storm', change: null })).toBeNull();
  });

  it('plays nothing on a change the landing marks as no foreground', () => {
    // The opening turn and the nightfall rule report a change without foreground.
    expect(fg({ worldWeather: 'rain', ...into('rain', false) })).toBeNull();
  });

  it('plays nothing on a change into Clear', () => {
    expect(fg({ worldWeather: 'clear', ...into('clear') })).toBeNull();
  });

  it('plays nothing in a Sheltered location', () => {
    expect(fg({ worldWeather: 'storm', sheltered: true, ...into('storm') })).toBeNull();
    expect(fg({ worldWeather: 'storm', sheltered: true, ...into(null) })).toBeNull();
  });

  it('plays stepping out of Shelter into the weather', () => {
    expect(fg({ worldWeather: 'rain', sheltered: false, ...into('rain') })).toBe('rain');
  });

  it('plays nothing with the Weather Foreground switch off', () => {
    expect(fg({ worldWeather: 'snow', foreground: false, ...into('snow') })).toBeNull();
  });

  it('plays with the Weather Background switch off', () => {
    expect(fg({ worldWeather: 'snow', background: false, ...into('snow') })).toBe('snow');
  });

  it('plays nothing under OS reduced motion', () => {
    expect(fg({ worldWeather: 'storm', reducedMotion: true, ...into('storm') })).toBeNull();
  });

  it('plays nothing while the world has Weather off', () => {
    expect(fg({ worldWeather: 'rain', weatherOn: false, ...into('rain') })).toBeNull();
  });

  it('plays nothing for Bright Sun outside daylight', () => {
    expect(fg({ worldWeather: 'brightSun', daylight: false, ...into('brightSun') })).toBeNull();
  });

  it('plays nothing when the weather moved on from the change', () => {
    expect(fg({ worldWeather: 'snow', ...into('rain') })).toBeNull();
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
