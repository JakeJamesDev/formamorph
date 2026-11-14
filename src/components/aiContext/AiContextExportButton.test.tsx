import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AiContextExportButton } from './AiContextExportButton';
import { exportAiContext } from '@/lib/aiContext/exportAiContext';

vi.mock('@/lib/aiContext/exportAiContext', () => ({ exportAiContext: vi.fn() }));

describe('AiContextExportButton', () => {
  it('exports nothing while blocked, and exports once the block is gone', () => {
    const { rerender } = render(<AiContextExportButton data={[1]} name="Fen" tip="Download" blockedReason="Blocked here" />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(exportAiContext).not.toHaveBeenCalled();

    rerender(<AiContextExportButton data={[1]} name="Fen" tip="Download" />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(exportAiContext).toHaveBeenCalledWith([1], 'Fen');
  });
});
