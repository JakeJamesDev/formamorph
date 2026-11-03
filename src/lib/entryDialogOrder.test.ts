import { describe, it, expect } from 'vitest';
import { nextEntryDialog } from './entryDialogOrder';

describe('nextEntryDialog', () => {
  it('opens the unreachable gate first, over a pending readme', () => {
    expect(nextEntryDialog({ aiGateDue: true, readmePending: true })).toBe('aiGate');
  });

  it('opens the readme once nothing ranks above it', () => {
    expect(nextEntryDialog({ aiGateDue: false, readmePending: true })).toBe('readme');
  });

  it('opens a lone readme at once, before reachability is known', () => {
    expect(nextEntryDialog({ aiGateDue: null, readmePending: true })).toBe('readme');
  });

  it('opens nothing when nothing is pending', () => {
    expect(nextEntryDialog({ aiGateDue: false, readmePending: false })).toBeNull();
  });
});
