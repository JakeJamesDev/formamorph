import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImageSetupGuide from './ImageSetupGuide';

// The real contract is the provider branch: the selected provider's setup command is shown and the other
// providers' are not. The CORS flag is the meaningful discriminator (the actual command a user must run), so
// we keep it; the surrounding heading/instruction copy is free to iterate and isn't pinned.
describe('ImageSetupGuide', () => {
  it("shows the ComfyUI CORS flag for the comfyui provider, not A1111's", () => {
    render(<ImageSetupGuide provider="comfyui" open onOpenChange={() => {}} />);
    expect(screen.getByText(/--enable-cors-header/)).toBeInTheDocument();
    expect(screen.queryByText(/--api --cors-allow-origins/)).not.toBeInTheDocument();
  });

  it("shows the A1111 CORS flag for the a1111 provider, not ComfyUI's", () => {
    render(<ImageSetupGuide provider="a1111" open onOpenChange={() => {}} />);
    expect(screen.getByText(/--api --cors-allow-origins=\*/)).toBeInTheDocument();
    expect(screen.queryByText(/--enable-cors-header/)).not.toBeInTheDocument();
  });

  it('tells a NovelAI user where the token lives, and what Stop does to Anlas', () => {
    render(<ImageSetupGuide provider="novelai" open onOpenChange={() => {}} />);
    expect(screen.getByText(/Get Persistent API Token/)).toBeInTheDocument();
    expect(screen.getByText(/may still cost Anlas/)).toBeInTheDocument();
    // Nothing to install — the "assumes it's already installed" line is for the local providers.
    expect(screen.queryByText(/already installed/)).not.toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<ImageSetupGuide provider="comfyui" open={false} onOpenChange={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
