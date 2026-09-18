import { describe, it, expect } from 'vitest';
import { nextEntryDialog } from './entryDialogOrder';

describe('nextEntryDialog', () => {
  it('opens the unreachable gate first, over a pending Demo AI dialog and readme', () => {
    expect(nextEntryDialog({ aiGateDue: true, demoAIPending: true, readmePending: true })).toBe('aiGate');
  });

  it('opens the Demo AI dialog before the readme', () => {
    expect(nextEntryDialog({ aiGateDue: false, demoAIPending: true, readmePending: true })).toBe('demoAI');
  });

  it('opens the readme once nothing ranks above it', () => {
    expect(nextEntryDialog({ aiGateDue: false, demoAIPending: false, readmePending: true })).toBe('readme');
  });

  it('opens a lone readme at once, before reachability is known', () => {
    expect(nextEntryDialog({ aiGateDue: null, demoAIPending: false, readmePending: true })).toBe('readme');
  });

  it('holds the Demo AI dialog and the readme until reachability is known', () => {
    expect(nextEntryDialog({ aiGateDue: null, demoAIPending: true, readmePending: true })).toBeNull();
  });

  it('opens nothing when nothing is pending', () => {
    expect(nextEntryDialog({ aiGateDue: false, demoAIPending: false, readmePending: false })).toBeNull();
  });
});
