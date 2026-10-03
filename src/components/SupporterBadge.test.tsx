import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RoleBadge } from './RoleBadge';
import { SupporterBadge } from './SupporterBadge';

afterEach(cleanup);

describe('the supporter badge', () => {
  it('names the tier', () => {
    render(<><SupporterBadge tier="supporter" /><SupporterBadge tier="supporter_plus" /></>);

    expect(screen.getByText('Supporter')).toBeTruthy();
    expect(screen.getByText('Supporter+')).toBeTruthy();
  });

  it('styles Supporter+ apart from Supporter by more than the label', () => {
    const { container } = render(<><SupporterBadge tier="supporter" /><SupporterBadge tier="supporter_plus" /></>);
    const [plain, plus] = Array.from(container.children) as HTMLElement[];

    expect(plus.className).toContain('ring-1');
    expect(plain.className).not.toContain('ring-1');
    expect(plus.querySelector('svg')?.outerHTML).not.toBe(plain.querySelector('svg')?.outerHTML);
  });

  it('shares no tint with a staff badge', () => {
    const tints = (node: HTMLElement) => node.className.split(' ').filter((c) => /^(bg|text)-/.test(c) && !c.startsWith('text-['));
    const { container } = render(
      <><SupporterBadge tier="supporter" /><SupporterBadge tier="supporter_plus" />
        <RoleBadge role="mod" /><RoleBadge role="dev" /><RoleBadge role="admin" /></>,
    );
    const [s, sp, ...staff] = Array.from(container.children) as HTMLElement[];

    for (const staffBadge of staff) {
      for (const tint of [...tints(s), ...tints(sp)]) expect(tints(staffBadge)).not.toContain(tint);
    }
  });
});
