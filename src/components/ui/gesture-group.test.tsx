import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { GestureGroupContext, useGestureStart, type GestureGroups } from './gesture-group';

function Control() {
  const start = useGestureStart();
  return (
    <>
      <button type="button">Elsewhere</button>
      <div data-testid="control" onPointerDown={start} />
    </>
  );
}

const mount = () => {
  const groups: GestureGroups = { begin: vi.fn(), end: vi.fn() };
  const view = render(<GestureGroupContext.Provider value={groups}><Control /></GestureGroupContext.Provider>);
  return { groups, control: view.getByTestId('control'), elsewhere: view.getByRole('button') };
};

describe('useGestureStart', () => {
  it('keeps the drag open while focus moves between elements, and ends it on release', () => {
    const { groups, control, elsewhere } = mount();
    fireEvent.pointerDown(control, { button: 0 });
    // Pressing a control takes focus from whatever held it; that blur is not the drag ending.
    fireEvent.blur(elsewhere);
    expect(groups.end).not.toHaveBeenCalled();

    fireEvent.pointerUp(window);
    expect(groups.begin).toHaveBeenCalledTimes(1);
    expect(groups.end).toHaveBeenCalledTimes(1);
  });

  it('ends the drag when the window itself loses focus', () => {
    const { groups, control } = mount();
    fireEvent.pointerDown(control, { button: 0 });
    fireEvent.blur(window);
    expect(groups.end).toHaveBeenCalledTimes(1);
  });
});
