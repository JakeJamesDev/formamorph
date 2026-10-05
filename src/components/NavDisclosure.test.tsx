import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { NavDisclosure } from './NavDisclosure';

function Host({ collapsed }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <NavDisclosure collapsed={collapsed} open={open} onOpenChange={setOpen} label="Sections" current="Stats" bodyId="body">
      <nav aria-label="Pages"><button type="button">Stats</button></nav>
    </NavDisclosure>
  );
}

describe('NavDisclosure', () => {
  it('names the current page and keeps the body inert while closed', () => {
    render(<Host />);
    expect(screen.getByRole('button', { name: /^Sections/ })).toHaveTextContent('Stats');
    expect(screen.getByRole('button', { name: /^Sections/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull();
    expect(document.getElementById('body')).toHaveAttribute('inert');
  });

  it('opens and closes the body from the bar', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: /^Sections/ }));
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeInTheDocument();
    expect(document.getElementById('body')).not.toHaveAttribute('inert');
    await user.click(screen.getByRole('button', { name: /^Sections/ }));
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull();
  });

  it('draws the body alone, always reachable, when not collapsed', () => {
    render(<Host collapsed={false} />);
    expect(screen.queryByRole('button', { name: /^Sections/ })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeInTheDocument();
  });
});
