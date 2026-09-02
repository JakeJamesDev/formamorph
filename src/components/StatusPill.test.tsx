import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { StatusPill } from './StatusPill';

afterEach(cleanup);

/** The pill's own element, which is what carries the tint. */
const pill = (status: string | null | undefined) => {
  cleanup();
  render(<StatusPill status={status} />);
  return screen.getByText(status || 'active');
};

describe('what state an account is in', () => {
  it('reads active, and looks it, when there is nothing to say', () => {
    // Empty and missing both mean an ordinary account, which is what the table shows for most rows.
    expect(pill('active').className).toContain('text-success');
    expect(pill(null).className).toContain('text-success');
    expect(pill(undefined).className).toContain('text-success');
  });

  it('tints a suspended account apart from a pending one', () => {
    expect(pill('suspended').className).toContain('text-destructive');
    expect(pill('pending').className).toContain('text-warning');
  });

  it('falls back to the active tint on a status this build has never heard of', () => {
    // A newer server can send one; an unstyled pill would read as a rendering fault rather than a state.
    expect(pill('archived').className).toContain('text-success');
  });
});
