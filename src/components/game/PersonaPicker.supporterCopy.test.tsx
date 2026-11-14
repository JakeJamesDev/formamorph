import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PersonaPicker } from './PersonaPicker';

afterEach(cleanup);

describe('the persona picker with a persona that is blocked here', () => {
  const library = [
    { id: 'marked', name: 'Mara Vale', blockedReason: 'You can only add this to the Supporter world it came from' },
    { id: 'plain', name: 'Quiet Cartographer' },
  ];

  it('shows the row disabled with its reason, and picks nothing from it', async () => {
    const onChange = vi.fn();
    rtlRender(<PersonaPicker library={library} value={{ source: 'none' }} onChange={onChange} />, { wrapper: TooltipProvider });

    const marked = screen.getByRole('radio', { name: 'Mara Vale' });
    expect(marked).toBeDisabled();
    expect(document.querySelector('[aria-description="You can only add this to the Supporter world it came from"]')).not.toBeNull();
    await userEvent.click(marked);
    expect(onChange).not.toHaveBeenCalled();

    expect(screen.getByRole('radio', { name: 'Quiet Cartographer' })).toBeEnabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Quiet Cartographer' }));
    expect(onChange).toHaveBeenCalledWith({ source: 'library', entityId: 'plain' });
  });
});
