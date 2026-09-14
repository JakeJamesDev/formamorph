import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdateAvailableDialog } from './UpdateAvailableDialog';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

afterEach(cleanup);

describe('UpdateAvailableDialog', () => {
  it('mounts the linked-content help in its title bar, opening on the Updates tab', () => {
    render(
      <UpdateAvailableDialog
        source={{ id: 'lib-1', name: 'Sedge', revision: 'r2', owned: true }}
        sourceData={{ id: 'lib-content', name: 'Sedge' }}
        rows={[{ worldId: 'w1', worldName: 'Marsh', itemId: 'copy-1', itemName: 'Sedge', kind: 'entity', state: 'linked' }]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Update Available' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('About Linked Content'));
    expect(screen.getByRole('tab', { name: 'Updates' })).toHaveAttribute('aria-selected', 'true');
  });
});
