import { describe, it, expect } from 'vitest';
import type { Opening, WorldOverview, WorldWeather } from '@/types';
import { activeWeather, allowedWeatherKinds, authoredStartWeather, experiencedWeather, savedWeather } from './weather';

const overview = (weather?: WorldWeather): WorldOverview => ({ name: 'Fen', ...(weather ? { weather } : {}) } as WorldOverview);
const opening = (weather?: Opening['weather']): Opening => ({ id: 'o', text: 'Start.', kind: 'action', ...(weather ? { weather } : {}) });
const on = (extra: Partial<WorldWeather> = {}): WorldWeather => ({ on: true, allowed: ['rain', 'storm'], ...extra });

describe('the weather a player experiences', () => {
  it('is the World Weather in an open location', () => {
    expect(experiencedWeather('storm', { })).toBe('storm');
    expect(experiencedWeather('rain', null)).toBe('rain');
  });

  it('is none in a Sheltered location, whatever the World Weather', () => {
    expect(experiencedWeather('storm', { sheltered: true })).toBeNull();
    expect(experiencedWeather(undefined, { sheltered: true })).toBeNull();
  });

  it('reads an absent World Weather as Clear', () => {
    expect(experiencedWeather(undefined, {})).toBe('clear');
  });
});

describe('the allowed weather kinds', () => {
  it('always include Clear and list only the kinds the author picked', () => {
    expect(allowedWeatherKinds(on())).toEqual(['clear', 'rain', 'storm']);
    expect(allowedWeatherKinds(null)).toEqual(['clear']);
  });

  it('read a hand-edited block with no list as Clear alone', () => {
    expect(allowedWeatherKinds({ on: true } as WorldWeather)).toEqual(['clear']);
  });

  it('read as off with no block or the switch off', () => {
    expect(activeWeather(overview())).toBeNull();
    expect(activeWeather(overview({ on: false, allowed: ['rain'] }))).toBeNull();
    expect(activeWeather(overview(on()))).not.toBeNull();
  });
});

describe('the weather a story starts in', () => {
  it('takes the drawn Opening first', () => {
    expect(authoredStartWeather(opening('storm'), overview(on({ defaultWeather: 'rain' })))).toBe('storm');
  });

  it('falls back to Default Weather when the Opening sets none', () => {
    expect(authoredStartWeather(opening(), overview(on({ defaultWeather: 'rain' })))).toBe('rain');
  });

  it('is null with neither, leaving the start unset', () => {
    expect(authoredStartWeather(opening(), overview(on()))).toBeNull();
    expect(authoredStartWeather(null, undefined)).toBeNull();
  });

  it('can author Clear over a stormy Default Weather', () => {
    expect(authoredStartWeather(opening('clear'), overview(on({ defaultWeather: 'storm' })))).toBe('clear');
  });

  it('is null while Weather is off, even with values left behind', () => {
    expect(authoredStartWeather(opening('storm'), overview({ on: false, allowed: ['storm'], defaultWeather: 'storm' }))).toBeNull();
  });

  it('skips a kind the world no longer allows, then reads the next level', () => {
    expect(authoredStartWeather(opening('snow'), overview(on({ defaultWeather: 'rain' })))).toBe('rain');
    expect(authoredStartWeather(opening('snow'), overview(on({ defaultWeather: 'snow' })))).toBeNull();
  });
});

describe('the saved weather', () => {
  it('stores Clear and unset as absent', () => {
    expect(savedWeather('clear')).toBeUndefined();
    expect(savedWeather(null)).toBeUndefined();
    expect(savedWeather('storm')).toBe('storm');
  });
});
