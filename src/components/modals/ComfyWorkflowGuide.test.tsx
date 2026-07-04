import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ComfyWorkflowGuide from './ComfyWorkflowGuide';

describe('ComfyWorkflowGuide', () => {
  it('explains the API export + tokens when open', () => {
    render(<ComfyWorkflowGuide open onOpenChange={() => {}} />);
    expect(screen.getByText('Use a workflow you already have')).toBeInTheDocument();
    expect(screen.getByText(/Export \(API\)/)).toBeInTheDocument();
    expect(screen.getByText('"%prompt%"')).toBeInTheDocument();
    expect(screen.getByText('"%sampler%"')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<ComfyWorkflowGuide open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText('Use a workflow you already have')).not.toBeInTheDocument();
  });
});
