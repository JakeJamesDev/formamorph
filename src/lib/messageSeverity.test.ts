import { describe, it, expect } from 'vitest';
import { MESSAGE_SEVERITIES, MESSAGE_SEVERITY_STYLES } from './messageSeverity';

describe('message severities', () => {
  it('styles every severity the composer offers', () => {
    for (const severity of MESSAGE_SEVERITIES) {
      expect(MESSAGE_SEVERITY_STYLES[severity]).toBeDefined();
      expect(MESSAGE_SEVERITY_STYLES[severity].label).toBeTruthy();
    }
  });

  it('matches the severities the server accepts', () => {
    expect(MESSAGE_SEVERITIES).toEqual(['info', 'warning', 'urgent']);
  });

  it('labels describe the message, never an action', () => {
    // "Suspension" read as though picking it would suspend the account. A severity label must not name
    // anything an admin could mistake for a consequence of sending.
    const labels = MESSAGE_SEVERITIES.map((s) => MESSAGE_SEVERITY_STYLES[s].label);

    expect(labels).toEqual(['Info', 'Warning', 'Urgent']);
    expect(labels.some((l) => /suspend|ban|delete|lock/i.test(l))).toBe(false);
  });
});
