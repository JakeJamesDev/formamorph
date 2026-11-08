import * as React from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tabs } from '@/components/ui/tabs';
import { MobilePanelStage } from './MobilePanelStage';

const TABS = [{ value: 'story' }, { value: 'game' }, { value: 'status' }] as const;
type Panel = (typeof TABS)[number]['value'];
const WIDTH = 300;

function Harness({ start = 'game' }: { start?: Panel }) {
  const [value, setValue] = React.useState<Panel>(start);
  return (
    <Tabs value={value} onValueChange={(next) => setValue(next as Panel)}>
      <MobilePanelStage
        tabs={TABS}
        value={value}
        onValueChange={setValue}
        renderPanel={(panel) => (
          <div>
            <p>{panel} body</p>
            <input aria-label={`${panel} field`} />
            {createPortal(<p>{panel} dialog</p>, document.body)}
          </div>
        )}
      />
    </Tabs>
  );
}

const stage = () => document.querySelector<HTMLElement>('[data-slide]')!;
const shown = () => screen.getAllByRole('tabpanel').map((el) => el.getAttribute('data-panel'));

const setup = (start?: Panel) => {
  render(<Harness start={start} />);
  Object.defineProperty(stage(), 'clientWidth', { configurable: true, value: WIDTH });
};

// A touch drag from (150, 200) by `dx`, `dy` in steps `msPerStep` apart.
function drag(dx: number, { dy = 0, from = stage() as Element, msPerStep = 50, steps = 5, end = true, pointerType = 'touch' } = {}) {
  let now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const at = (i: number) => ({ pointerId: 1, pointerType, isPrimary: true, clientX: 150 + (dx * i) / steps, clientY: 200 + (dy * i) / steps });
  fireEvent.pointerDown(from, at(0));
  for (let i = 1; i <= steps; i++) {
    now += msPerStep;
    fireEvent.pointerMove(stage(), at(i));
  }
  if (end) fireEvent.pointerUp(stage(), at(steps));
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MobilePanelStage', () => {
  it('shows the next tab beside the panel while a drag moves left', () => {
    setup();
    drag(-120, { end: false });
    expect(shown()).toEqual(['game', 'status']);
    expect(document.querySelector<HTMLElement>('[data-panel="game"]')!.style.transform).toBe('translateX(-120px)');
    expect(document.querySelector<HTMLElement>('[data-panel="status"]')!.style.transform).toBe(`translateX(${WIDTH - 120}px)`);
  });

  it('moves to the tab on the right after a drag left past a quarter of the width', () => {
    setup();
    drag(-120);
    expect(shown()).toEqual(['status']);
    expect(stage().dataset.slide).toBe('next');
  });

  it('moves to the tab on the left after a drag right', () => {
    setup();
    drag(120);
    expect(shown()).toEqual(['story']);
    expect(stage().dataset.slide).toBe('back');
  });

  it('finishes the slide from where the finger let go', () => {
    setup();
    drag(-120);
    expect(document.querySelector<HTMLElement>('[data-panel="status"]')!.style.getPropertyValue('--drag-from')).toBe(`${WIDTH - 120}px`);
  });

  it('settles back after a short, slow drag', async () => {
    setup();
    drag(-40, { msPerStep: 100 });
    await settle();
    expect(shown()).toEqual(['game']);
    expect(document.querySelector<HTMLElement>('[data-panel="game"]')!.style.transform).toBe('');
  });

  it('takes a short, fast flick as a tab change', () => {
    setup();
    drag(-40, { msPerStep: 5 });
    expect(shown()).toEqual(['status']);
  });

  it('settles back when the browser cancels the touch', async () => {
    setup();
    drag(-120, { end: false });
    fireEvent.pointerCancel(stage(), { pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 200 });
    await settle();
    expect(shown()).toEqual(['game']);
  });

  it('stays on the last tab when dragged past it', async () => {
    setup('status');
    drag(-150, { end: false });
    expect(shown()).toEqual(['status']);
    // The panel follows the finger only part of the way.
    expect(document.querySelector<HTMLElement>('[data-panel="status"]')!.style.transform).toBe('translateX(-45px)');
    fireEvent.pointerUp(stage(), { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 200 });
    await settle();
    expect(shown()).toEqual(['status']);
  });

  it('leaves a vertical drag to the scroller', () => {
    setup();
    drag(-30, { dy: 120 });
    expect(shown()).toEqual(['game']);
    expect(document.querySelector<HTMLElement>('[data-panel="game"]')!.style.transform).toBe('');
  });

  it('leaves a drag that starts in a text field to the field', () => {
    setup();
    drag(-120, { from: screen.getByRole('textbox', { name: 'game field' }) });
    expect(shown()).toEqual(['game']);
  });

  it('ignores a drag in a dialog the panel portals out', () => {
    setup();
    drag(-120, { from: screen.getByText('game dialog') });
    expect(shown()).toEqual(['game']);
  });

  it('ignores a mouse drag', () => {
    setup();
    drag(-120, { pointerType: 'mouse' });
    expect(shown()).toEqual(['game']);
  });
});
