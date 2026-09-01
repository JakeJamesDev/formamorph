import { describe, it, expect, beforeEach } from 'vitest';
import { AGE_GATE_VERSION, acceptAgeGate, isAgeAttested } from './ageGate';

const STORAGE_KEY = 'FORMAMORPH_ageGate';

/** What is actually on disk, which is what a later server-side policy would find and adopt. */
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Record<string, unknown> | null;

beforeEach(() => localStorage.clear());

describe('the age-gate flag', () => {
  it('starts unattested on a device that has never answered', () => {
    expect(stored()).toBeNull();
    expect(isAgeAttested()).toBe(false);
  });

  it('attests once accepted', () => {
    acceptAgeGate();
    expect(isAgeAttested()).toBe(true);
  });

  it('stores the policy shape a server-side gate would sync into', () => {
    acceptAgeGate();

    expect(stored()).toMatchObject({ accepted: true, acceptanceVersion: AGE_GATE_VERSION });
    expect(Date.parse(String(stored()?.acceptedAt))).not.toBeNaN();
  });

  it('re-prompts when the copy has moved on since the acceptance', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      accepted: true,
      acceptanceVersion: AGE_GATE_VERSION - 1,
      acceptedAt: new Date().toISOString(),
    }));

    expect(isAgeAttested()).toBe(false);
  });

  it('keeps attesting for an acceptance recorded against later copy', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      accepted: true,
      acceptanceVersion: AGE_GATE_VERSION + 1,
      acceptedAt: new Date().toISOString(),
    }));

    expect(isAgeAttested()).toBe(true);
  });

  it('reads an unparseable or half-written record as unanswered rather than as a yes', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    expect(isAgeAttested()).toBe(false);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ acceptanceVersion: AGE_GATE_VERSION }));
    expect(isAgeAttested()).toBe(false);
  });

  it('asks again once app data is wiped', () => {
    acceptAgeGate();
    localStorage.clear();

    expect(isAgeAttested()).toBe(false);
  });
});
