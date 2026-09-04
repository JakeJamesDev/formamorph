import { describe, expect, it } from 'vitest';
import { recordView, resolveBackAction, type BackAction, type BackButtonState } from './backAction';

describe('resolveBackAction', () => {
  const cases: { name: string; state: BackButtonState; expected: BackAction }[] = [
    {
      name: 'closes the top layer when a modal is open on the main menu',
      state: { modalOpen: true, subScreens: 0, viewHistory: ['mainMenu'] },
      expected: 'close-modal',
    },
    {
      name: 'closes the top layer before leaving a nested view',
      state: { modalOpen: true, subScreens: 0, viewHistory: ['mainMenu', 'gameViewer'] },
      expected: 'close-modal',
    },
    {
      name: 'goes back one view from a nested view',
      state: { modalOpen: false, subScreens: 0, viewHistory: ['mainMenu', 'gameViewer'] },
      expected: 'go-back',
    },
    {
      name: 'goes back from a view reached through several others',
      state: { modalOpen: false, subScreens: 0, viewHistory: ['mainMenu', 'gameViewer', 'vrmViewer'] },
      expected: 'go-back',
    },
    {
      name: 'asks before leaving from the main menu',
      state: { modalOpen: false, subScreens: 0, viewHistory: ['mainMenu'] },
      expected: 'confirm-exit',
    },
    {
      name: 'asks before leaving when no view has been recorded',
      state: { modalOpen: false, subScreens: 0, viewHistory: [] },
      expected: 'confirm-exit',
    },
    {
      name: "runs the open layer's own back step instead of dismissing it",
      state: { modalOpen: true, subScreens: 1, stopInsideLayer: true, viewHistory: ['mainMenu'] },
      expected: 'go-back',
    },
    {
      name: "dismisses a layer raised over a sub-screen before it runs the sub-screen's back step",
      state: { modalOpen: true, subScreens: 1, stopInsideLayer: false, viewHistory: ['mainMenu'] },
      expected: 'close-modal',
    },
    {
      name: 'leaves a full-screen sub-screen before it leaves the view it fills',
      state: { modalOpen: false, subScreens: 1, viewHistory: ['mainMenu'] },
      expected: 'go-back',
    },
    {
      name: 'unwinds sub-screens one at a time',
      state: { modalOpen: false, subScreens: 2, viewHistory: ['mainMenu'] },
      expected: 'go-back',
    },
    {
      name: 'closes the top layer before it leaves a sub-screen',
      state: { modalOpen: true, subScreens: 1, viewHistory: ['mainMenu'] },
      expected: 'close-modal',
    },
  ];

  it.each(cases)('$name', ({ state, expected }) => {
    expect(resolveBackAction(state)).toBe(expected);
  });
});

describe('recordView', () => {
  it('pushes a view the trail has not seen', () => {
    expect(recordView(['mainMenu'], 'gameViewer')).toEqual(['mainMenu', 'gameViewer']);
  });

  it('starts the trail when there is nothing in it', () => {
    expect(recordView([], 'mainMenu')).toEqual(['mainMenu']);
  });

  it('leaves the trail alone when the view is already on screen', () => {
    const trail = ['mainMenu', 'gameViewer'];
    expect(recordView(trail, 'gameViewer')).toBe(trail);
  });

  it('pops back to a view the trail already holds instead of pushing it again', () => {
    expect(recordView(['mainMenu', 'gameViewer', 'vrmViewer'], 'mainMenu')).toEqual(['mainMenu']);
  });

  it('pops to the most recent visit when a view appears twice', () => {
    expect(recordView(['mainMenu', 'gameViewer', 'mainMenu', 'vrmViewer'], 'gameViewer'))
      .toEqual(['mainMenu', 'gameViewer']);
  });
});
