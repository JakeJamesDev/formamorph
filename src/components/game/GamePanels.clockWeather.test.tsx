// The clock's weather icon and tip: the World Weather, Clear as sun or moon, nothing in a Clear-only world.
import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderRightPanel, type Gameplay } from '@/test/gamePanels';
import { formatAbsolute, formatClock } from '@/lib/gameClock';
import { isDaylight } from '@/lib/weather';
import type { GameLocation, WeatherKind, WorldWeather } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const HOUR = 60;
const dayTime = Array.from({ length: 24 }, (_, h) => h * HOUR).find((t) => isDaylight(t))!;
const nightTime = Array.from({ length: 24 }, (_, h) => h * HOUR).find((t) => !isDaylight(t))!;

const yard = (sheltered: boolean): GameLocation => ({ id: 'yard', name: 'Yard', description: '', ...(sheltered && { sheltered }) }) as GameLocation;

const mount = (weather: WorldWeather, kind: WeatherKind, time: number, sheltered = false) => {
  const view = renderRightPanel({}, {
    world: { worldOverview: { weather } as never, locations: [yard(sheltered)] },
    seed: (g: Gameplay) => { g.setWeather(kind); g.setGameTime(time); g.setCurrentLocation(yard(sheltered)); },
  });
  const clock = screen.getByText(formatAbsolute(time));
  return { view, clock, icon: () => clock.querySelector('svg') };
};

describe('the clock weather', () => {
  it('shows the World Weather icon before the clock', () => {
    const { icon } = mount({ allowed: ['clear', 'rain', 'storm'] }, 'rain', dayTime);
    expect(icon()?.getAttribute('class')).toContain('lucide-cloud-rain');
  });

  it('shows Clear as the sun by day', () => {
    expect(mount({ allowed: ['clear', 'rain'] }, 'clear', dayTime).icon()?.getAttribute('class')).toContain('lucide-sun-medium');
  });

  it('shows Clear as the moon at night', () => {
    expect(mount({ allowed: ['clear', 'rain'] }, 'clear', nightTime).icon()?.getAttribute('class')).toContain('lucide-moon');
  });

  it('shows a fixed weather', () => {
    expect(mount({ allowed: ['snow'] }, 'snow', dayTime).icon()?.getAttribute('class')).toContain('lucide-snowflake');
  });

  it('shows no icon in a world that allows Clear alone', () => {
    expect(mount({ allowed: ['clear'] }, 'clear', dayTime).icon()).toBeNull();
  });

  it('names the weather after the exact clock in the tip, sheltered included', async () => {
    const { clock } = mount({ allowed: ['clear', 'rain'] }, 'rain', dayTime, true);
    act(() => { clock.focus(); });
    expect((await screen.findAllByText(`${formatClock(dayTime)} · Rain, sheltered`)).length).toBeGreaterThan(0);
  });
});
