import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImageSetupGuide from './ImageSetupGuide';

describe('ImageSetupGuide', () => {
  it('shows only the selected provider (ComfyUI) and its bare CORS flag', () => {
    render(<ImageSetupGuide provider="comfyui" open onOpenChange={() => {}} />);
    expect(screen.getByText('Set up ComfyUI')).toBeInTheDocument();
    expect(screen.getByText('--enable-cors-header')).toBeInTheDocument();
    // Other providers' setup is not shown.
    expect(screen.queryByText(/--api --cors-allow-origins/)).not.toBeInTheDocument();
  });

  it('shows the A1111 flag when A1111 is selected', () => {
    render(<ImageSetupGuide provider="a1111" open onOpenChange={() => {}} />);
    expect(screen.getByText('Set up Automatic1111 / Forge')).toBeInTheDocument();
    expect(screen.getByText(/--api --cors-allow-origins=\*/)).toBeInTheDocument();
    expect(screen.queryByText('--enable-cors-header')).not.toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<ImageSetupGuide provider="comfyui" open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText('Set up ComfyUI')).not.toBeInTheDocument();
  });
});
