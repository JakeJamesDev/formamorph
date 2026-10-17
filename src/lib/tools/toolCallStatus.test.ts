/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { toolCallStatus } from './toolCallStatus';

describe('toolCallStatus', () => {
  it('names the Tool a round calls', () => {
    expect(toolCallStatus([['roll_fate']])).toBe('Calling roll_fate…');
  });

  it('names each Tool once across rounds, in call order', () => {
    expect(toolCallStatus([['get_entity', 'roll_fate'], ['roll_fate']])).toBe('Calling get_entity, roll_fate…');
  });

  it('shows no line with no round waiting', () => {
    expect(toolCallStatus([])).toBeNull();
    expect(toolCallStatus([[]])).toBeNull();
  });
});
