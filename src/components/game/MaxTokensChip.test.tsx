import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MaxTokensChip } from './MaxTokensChip';
import type { DebugEndpointInfo } from '@/lib/promptEndpoints';

const endpoint = (maxTokens?: number): DebugEndpointInfo => ({
  preset: 'Cloud', routed: false, model: 'big-24b', url: 'https://api.example.com/v1', reasoningFields: [],
  ...(maxTokens !== undefined && { maxTokens }),
});

describe('MaxTokensChip', () => {
  it('draws the max_tokens the request sent', () => {
    render(<MaxTokensChip endpoint={endpoint(1200)} />);
    expect(screen.getByText('Max Tokens 1,200')).toBeTruthy();
  });

  it('draws nothing for a request that sent no max_tokens', () => {
    const { container } = render(<MaxTokensChip endpoint={endpoint()} />);
    expect(container.textContent).toBe('');
  });
});
