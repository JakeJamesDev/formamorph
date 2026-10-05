import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { RESIZE_HANDLES } from '@/lib/formaquestion/windowBox';
import { helpAi } from '@/test/helpAiFixture';
import { storeFramedWindow, storeMinimalWindow } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';
import { PILL_FADE_DELAY_MS } from './usePillFade';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { Formaquestion } from './Formaquestion';

const loadFixture = () => Promise.resolve(createDocsIndex({ pages: { Settings: '# ⚙️ Settings\n\nSettings hold your options.\n' }, sidebar: '- [Settings](Settings)\n' }));

const helpWindow = () => screen.getByRole('dialog', { name: 'Formaquestion' });
const handle = (name: string) => helpWindow().querySelector<HTMLElement>(`[data-fq-resize="${name}"]`)!;
const markOf = (name: string) => handle(name).firstElementChild as HTMLElement;
const fadeOf = (name: string) => markOf(name).getAttribute('data-fq-fade');
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const px = (value: string) => parseFloat(value);

function drag(target: HTMLElement, dx: number, dy: number) {
  fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 800, clientY: 500 });
  fireEvent.pointerMove(target, { pointerId: 1, clientX: 800 + dx, clientY: 500 + dy });
  fireEvent.pointerUp(target, { pointerId: 1 });
}

async function openWindow() {
  render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  await act(async () => {});
  screen.getByRole('textbox', { name: 'Ask a Question' });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('innerWidth', 1600);
  vi.stubGlobal('innerHeight', 900);
  ai.current = helpAi({ revalidate: vi.fn(async () => true), requestSurface: vi.fn() });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each([
  { chrome: 'full', store: storeFramedWindow },
  { chrome: 'minimal', store: storeMinimalWindow },
])('the resize handles on the $chrome chrome', ({ store }) => {
  it('draws a handle on every side and corner, hidden until the pointer is near, and fades it after the pill delay', async () => {
    store();
    await openWindow();
    for (const name of RESIZE_HANDLES) expect(fadeOf(name)).toBe('hidden');

    fireEvent.pointerEnter(handle('w'));
    expect(fadeOf('w')).toBe('shown');
    expect(fadeOf('e')).toBe('hidden');
    expect(markOf('w')).toHaveClass('transition-opacity');

    fireEvent.pointerLeave(handle('w'));
    wait(PILL_FADE_DELAY_MS - 1);
    expect(fadeOf('w')).toBe('shown');
    wait(1);
    expect(fadeOf('w')).toBe('hidden');
    expect(markOf('w')).toHaveClass('opacity-0');
  });

  it('keeps the corner marks up and the side marks hidden on a touch screen', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('coarse'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    store();
    await openWindow();
    expect(fadeOf('se')).toBe('shown');
    expect(fadeOf('nw')).toBe('shown');
    fireEvent.pointerEnter(handle('n'));
    expect(fadeOf('n')).toBe('hidden');
  });
});

describe('what each handle moves on the framed window', () => {
  const frame = () => helpWindow();
  const box = () => ({ x: px(frame().style.left), y: px(frame().style.top), w: px(frame().style.width), h: px(frame().style.height) });

  it('moves one edge from a side and keeps the others', async () => {
    storeFramedWindow();
    await openWindow();
    const start = box();
    drag(handle('w'), -40, 50);
    expect(box()).toEqual({ ...start, x: start.x - 40, w: start.w + 40 });

    const grown = box();
    drag(handle('n'), 30, -20);
    expect(box()).toEqual({ ...grown, y: grown.y - 20, h: grown.h + 20 });
  });

  it('moves both edges from a corner, with the far corner put', async () => {
    storeFramedWindow();
    await openWindow();
    const start = box();
    drag(handle('ne'), 40, -30);
    expect(box()).toEqual({ ...start, y: start.y - 30, w: start.w + 40, h: start.h + 30 });
  });
});
