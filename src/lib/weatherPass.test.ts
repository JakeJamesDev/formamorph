import { describe, it, expect } from 'vitest';
import type { WeatherKind } from '@/types';
import { parseWeatherReply, weatherPassSchema, weatherTextFormat } from './weatherPass';

const OFFERED: WeatherKind[] = ['clear', 'rain', 'brightSun'];

describe('the Weather Pass reply', () => {
  it('reads each offered kind, and no change as null', () => {
    expect(parseWeatherReply('rain', OFFERED)).toBe('rain');
    expect(parseWeatherReply('Bright sun.', OFFERED)).toBe('brightSun');
    expect(parseWeatherReply('clear', OFFERED)).toBe('clear');
    expect(parseWeatherReply('No change', OFFERED)).toBeNull();
  });

  it('reads the first answer word in stray prose', () => {
    expect(parseWeatherReply('The answer is rain, not clear.', OFFERED)).toBe('rain');
    expect(parseWeatherReply('no change - still rain', OFFERED)).toBeNull();
  });

  it('reads a kind outside the offer, or nonsense, as no change', () => {
    expect(parseWeatherReply('snow', OFFERED)).toBeNull();
    expect(parseWeatherReply('drizzle', OFFERED)).toBeNull();
    expect(parseWeatherReply('{"weather":"storm"}', OFFERED)).toBeNull();
  });

  it('reads the schema reply, and a "no" gate as no change', () => {
    expect(parseWeatherReply('{"shown":"yes","weather":"bright sun"}', OFFERED)).toBe('brightSun');
    expect(parseWeatherReply('{"shown":"yes","weather":"no change"}', OFFERED)).toBeNull();
    expect(parseWeatherReply('{"shown":"no","weather":"rain"}', OFFERED)).toBeNull();
  });

  it('reads the text reply behind its gate', () => {
    expect(parseWeatherReply('yes - rain', OFFERED)).toBe('rain');
    expect(parseWeatherReply('no - rain', OFFERED)).toBeNull();
    expect(parseWeatherReply('no -, rain', OFFERED)).toBeNull();
    expect(parseWeatherReply('yes - no change', OFFERED)).toBeNull();
  });

  it('offers exactly no change and the offered kinds', () => {
    expect(weatherPassSchema(OFFERED).schema).toMatchObject({ properties: { weather: { enum: ['no change', 'clear', 'rain', 'bright sun'] } } });
    expect(weatherTextFormat({ current: 'rain', offered: OFFERED })).toContain('no change, clear, rain, bright sun.');
  });
});
