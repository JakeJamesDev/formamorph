import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { RoleBadge } from './RoleBadge';

afterEach(cleanup);

describe('the staff badge', () => {
  it('says which role, in the app’s own words', () => {
    render(<RoleBadge role="mod" />);

    expect(screen.getByText('Mod')).toBeTruthy();
  });

  it('tints the three roles apart', () => {
    // A thread should be scannable without reading every tag.
    const styles = ['mod', 'dev', 'admin'].map((role) => {
      const { container } = render(<RoleBadge role={role} />);
      const badge = container.firstChild as HTMLElement;
      return badge.className;
    });

    expect(new Set(styles).size).toBe(3);
  });

  it('renders nothing for an ordinary reply', () => {
    // Most replies are ordinary; a "User" tag on every one of them is noise.
    const { container } = render(<RoleBadge role={null} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for a role this build does not know', () => {
    // A future server role must not render as a blank tag or leak its raw name.
    const { container } = render(<RoleBadge role="overlord" />);

    expect(container.firstChild).toBeNull();
  });
});
