import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ComfyWorkflowGuide from './ComfyWorkflowGuide';

// This is a static instruction modal — the only real contract is that it opens and closes. The %tokens% it
// documents are contractually verified where they're actually consumed (lib/imageGen/comfyui.test.ts), and
// the instruction copy is free to iterate, so we don't pin it here.
describe('ComfyWorkflowGuide', () => {
  it('renders the guide dialog when open', () => {
    render(<ComfyWorkflowGuide open onOpenChange={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<ComfyWorkflowGuide open={false} onOpenChange={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
