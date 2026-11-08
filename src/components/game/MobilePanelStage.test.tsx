import * as React from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MobilePanelStage } from './MobilePanelStage';
import { createSwipeProgress, type SwipeGlide } from '@/lib/swipeProgress';
import { usePanelShown } from '@/lib/panelShown';

const TABS = [{ value: 'story' }, { value: 'game' }, { value: 'status' }] as const;
type Panel = (typeof TABS)[number]['value'];
const WIDTH = 300;

let swipe = createSwipeProgress();
const renders: Record<Panel, number> = { story: 0, game: 0, status: 0 };

// Reports whether its panel shows, and counts the panel's renders.
function Mark({ panel, tick }: { panel: Panel; tick: number }) {
  renders[panel] += 1;
  return <span data-testid={`mark-${panel}`} data-tick={tick}>{usePanelShown() ? 'shown' : 'hidden'}</span>;
}

function Harness({ start = 'game', tick = 0 }: { start?: Panel; tick?: number }) {
  const [value, setValue] = React.useState<Panel>(start);
  return (
    <Tabs value={value} onValueChange={(next) => setValue(next as Panel)}>
      <TabsList>{TABS.map(({ value: v }) => <TabsTrigger key={v} value={v}>{v}</TabsTrigger>)}</TabsList>
      <MobilePanelStage
        tabs={TABS}
        value={value}
        onValueChange={setValue}
        progress={swipe}
        renderPanel={(panel) => (
          <div>
            <p>{panel} body</p>
            <Mark panel={panel} tick={tick} />
            <input aria-label={`${panel} field`} />
            {createPortal(<p>{panel} dialog</p>, document.body)}
          </div>
        )}
      />
    </Tabs>
  );
}

const marks = () => TABS.map(({ value: v }) => `${v}:${screen.getByTestId(`mark-${v}`).textContent}`);

const track = () => document.querySelector<HTMLElement>('[data-panel-track]')!;
const stage = () => track().parentElement!;
const panel = (name: Panel) => document.querySelector<HTMLElement>(`[data-panel="${name}"]`)!;
const shown = () => screen.getAllByRole('tabpanel').map((el) => el.getAttribute('data-panel'));

const setup = (start?: Panel) => {
  swipe = createSwipeProgress();
  render(<Harness start={start} />);
  Object.defineProperty(stage(), 'clientWidth', { configurable: true, value: WIDTH });
};

// jsdom has no Web Animations; this stands in for a glide that is still running.
function stubGlide() {
  const runs: { frames: Keyframe[]; cancel: ReturnType<typeof vi.fn> }[] = [];
  Object.defineProperty(track(), 'animate', {
    configurable: true,
    value: (frames: Keyframe[]) => {
      const run = { frames, cancel: vi.fn(), finished: new Promise(() => {}) };
      runs.push(run);
      return run;
    },
  });
  return runs;
}

let now = 1000;
// A touch drag from (150, 200) by `dx`, `dy` in `steps` moves `msPerStep` apart.
function drag(dx: number, { dy = 0, from = stage() as Element, msPerStep = 50, steps = 5, end = true, holdMs = 0, pointerType = 'touch' } = {}) {
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const at = (i: number) => ({ pointerId: 1, pointerType, isPrimary: true, clientX: 150 + (dx * i) / steps, clientY: 200 + (dy * i) / steps });
  fireEvent.pointerDown(from, at(0));
  for (let i = 1; i <= steps; i++) {
    now += msPerStep;
    fireEvent.pointerMove(stage(), at(i));
  }
  now += holdMs;
  if (end) fireEvent.pointerUp(stage(), at(steps));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MobilePanelStage', () => {
  it('rests on the open tab and keeps the others out of reach', () => {
    setup();
    expect(track().style.transform).toBe('translateX(-100%)');
    expect(shown()).toEqual(['game']);
    expect(panel('story')).toHaveAttribute('inert');
    expect(panel('status')).toHaveAttribute('inert');
    expect(panel('game')).not.toHaveAttribute('inert');
  });

  it('moves the strip with the finger from where the drag takes hold', () => {
    setup();
    drag(-120, { end: false });
    // It takes hold after the first 24px step, so the strip has moved by the rest.
    expect(track().style.transform).toBe('translateX(-396px)');
    // In tabs from the first, for the tab pill.
    expect(swipe.get()).toEqual({ at: expect.closeTo(1.32) });
  });

  it('hands the pill one glide on release, not a report per frame', () => {
    setup();
    stubGlide();
    drag(-180, { steps: 6, msPerStep: 100 });
    const glide = swipe.get() as SwipeGlide;
    expect(glide.from).toBeCloseTo(1.5);
    expect(glide.to).toBe(2);
  });

  it('tells each panel whether it shows: the open one at rest, both while one slides in', () => {
    setup();
    expect(marks()).toEqual(['story:hidden', 'game:shown', 'status:hidden']);
    drag(-120, { end: false });
    expect(marks()).toEqual(['story:hidden', 'game:shown', 'status:shown']);
    now += 100; // held still, so it settles back
    fireEvent.pointerUp(stage(), { pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 200 });
    expect(marks()).toEqual(['story:hidden', 'game:shown', 'status:hidden']);
  });

  it('keeps out-of-view panels from rendering again until they show', () => {
    swipe = createSwipeProgress();
    const view = render(<Harness tick={0} />);
    const counted = { ...renders };
    view.rerender(<Harness tick={1} />);
    expect(renders.game).toBeGreaterThan(counted.game);
    expect(renders.story).toBe(counted.story);
    expect(renders.status).toBe(counted.status);
    // Once it shows, it catches up with the latest props.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'status' }));
    expect(screen.getByTestId('mark-status')).toHaveAttribute('data-tick', '1');
  });

  it('takes a new touch when the last one never ended here', () => {
    setup();
    fireEvent.pointerDown(stage(), { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: 150, clientY: 200 });
    // Its pointerup went to an overlay outside the stage; the next touch must still swipe.
    drag(-180, { steps: 6, msPerStep: 100 });
    expect(shown()).toEqual(['status']);
  });

  it('settles when the drag loses its pointer capture', () => {
    setup();
    drag(-120, { end: false });
    fireEvent.lostPointerCapture(stage(), { pointerId: 1, pointerType: 'touch' });
    expect(track().style.transform).toBe('translateX(-100%)');
  });

  it('keeps dragging when the touched element hands its capture to the strip', () => {
    setup();
    drag(-120, { end: false, from: screen.getByText('game body') });
    // The browser's implicit capture on the touched element ends as the strip takes it.
    fireEvent.lostPointerCapture(screen.getByText('game body'), { pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerMove(stage(), { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 200 });
    expect(track().style.transform).toBe('translateX(-426px)');
  });

  it('reports the strip at rest once it lands', () => {
    setup();
    drag(-180, { steps: 6, msPerStep: 100 });
    expect(swipe.get()).toBeNull();
  });

  it('lands on the tab to the right after a slow drag left past half way', () => {
    setup();
    const runs = stubGlide();
    drag(-180, { steps: 6, msPerStep: 100 });
    expect(shown()).toEqual(['status']);
    // The glide starts where the finger let go.
    expect(runs[0].frames.map((f) => f.transform)).toEqual(['translateX(-450px)', 'translateX(-600px)']);
  });

  it('lands on the tab to the left after a drag right', () => {
    setup();
    drag(180, { steps: 6, msPerStep: 100 });
    expect(shown()).toEqual(['story']);
    expect(track().style.transform).toBe('translateX(0%)');
  });

  it('settles back after a short, slow drag', () => {
    setup();
    drag(-60, { steps: 6, msPerStep: 100 });
    expect(shown()).toEqual(['game']);
    expect(track().style.transform).toBe('translateX(-100%)');
  });

  // 0.5 px/ms: its carry alone would land back on Game.
  it('takes a short flick as a tab change', () => {
    setup();
    drag(-40, { steps: 4, msPerStep: 20 });
    expect(shown()).toEqual(['status']);
  });

  it('drops the flick when the finger stops before lifting', () => {
    setup();
    drag(-40, { steps: 4, msPerStep: 20, holdMs: 100 });
    expect(shown()).toEqual(['game']);
  });

  const offset = () => Number(/translateX\((-?[\d.]+)px\)/.exec(track().style.transform)?.[1]);

  it('crosses every panel in one drag', () => {
    setup('story');
    drag(-660, { steps: 11, msPerStep: 100, end: false });
    expect(track().style.transform).toBe('translateX(-600px)');
    fireEvent.pointerUp(stage(), { pointerId: 1, pointerType: 'touch', clientX: -510, clientY: 200 });
    expect(shown()).toEqual(['status']);
  });

  it('holds past the last tab, never further than a third of a panel', () => {
    setup('status');
    drag(-150, { end: false });
    // 120px past the end, after the first step takes hold.
    expect(offset()).toBeCloseTo(-643.8, 1);
    drag(-3000, { end: false, from: stage() });
    expect(offset()).toBeGreaterThan(-600 - WIDTH * 0.3);
    fireEvent.pointerUp(stage(), { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 200 });
    expect(shown()).toEqual(['status']);
  });

  it('holds past the first tab too', () => {
    setup('story');
    drag(150, { end: false });
    expect(offset()).toBeCloseTo(43.8, 1);
  });

  it('glides to a tapped tab', () => {
    setup();
    const runs = stubGlide();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'status' }));
    expect(runs[0].frames.map((f) => f.transform)).toEqual(['translateX(-300px)', 'translateX(-600px)']);
    expect(shown()).toEqual(['status']);
  });

  it('catches a glide in progress with no wait', () => {
    setup();
    const runs = stubGlide();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'status' }));
    drag(-100, { end: false });
    expect(runs[0].cancel).toHaveBeenCalled();
    expect(track().style.transform).toBe('translateX(-380px)');
  });

  it('settles back when the browser cancels the touch', () => {
    setup();
    drag(-120, { end: false });
    fireEvent.pointerCancel(stage(), { pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 200 });
    expect(shown()).toEqual(['game']);
    expect(track().style.transform).toBe('translateX(-100%)');
  });

  it('leaves a vertical drag to the scroller', () => {
    setup();
    drag(-30, { dy: 120, end: false });
    expect(track().style.transform).toBe('translateX(-100%)');
  });

  it('leaves a drag that starts in a text field to the field', () => {
    setup();
    drag(-120, { from: screen.getByRole('textbox', { name: 'game field' }) });
    expect(track().style.transform).toBe('translateX(-100%)');
  });

  it('ignores a drag in a dialog the panel portals out', () => {
    setup();
    drag(-120, { from: screen.getAllByText('game dialog')[0] });
    expect(track().style.transform).toBe('translateX(-100%)');
  });

  it('ignores a mouse drag', () => {
    setup();
    drag(-120, { pointerType: 'mouse' });
    expect(track().style.transform).toBe('translateX(-100%)');
  });
});
