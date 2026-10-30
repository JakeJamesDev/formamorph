import { describe, it, expect } from 'vitest';
import { NO_PLACES, stepPlace, withPlace } from './gameEditorPlaces';

const place = (tab: string, selectedId: string | null = null) => ({ tab, selectedId, entityTab: 'profile' });
const visited = [place('overview'), place('entities', 'suya')].reduce(withPlace, NO_PLACES);

describe('the Game Editor places', () => {
  it('adds a place once', () => {
    expect(withPlace(visited, place('entities', 'suya'))).toBe(visited);
  });

  it('steps back and forward, and stops at each end', () => {
    const back = stepPlace(visited, -1)!;
    expect(back.list[back.at]).toEqual(place('overview'));
    expect(stepPlace(back, -1)).toBeNull();
    expect(stepPlace(stepPlace(back, 1)!, 1)).toBeNull();
  });

  it('drops what lay ahead when a new place is visited after stepping back', () => {
    const branched = withPlace(stepPlace(visited, -1)!, place('entities', 'grukk'));
    expect(branched.list.map((p) => p.selectedId)).toEqual([null, 'grukk']);
  });
});
