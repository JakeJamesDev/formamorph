import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { AiToolRound } from '@/lib/aiRequest/toolLoop';
import { ToolRoundsView } from './ToolRoundsView';

const round = (over: Partial<AiToolRound> = {}): AiToolRound => ({
  index: 1,
  messages: [],
  content: '',
  reasoning: 'Bram is here, so I fetch him.',
  finishReason: 'tool_calls',
  calls: [{
    id: '000000001',
    name: 'get_entity',
    arguments: '{"name":"Bram"}',
    result: '{"matches":[{"id":"ent-bram","name":"Bram","description":"The ferryman."}]}',
  }],
  ...over,
});

describe('ToolRoundsView', () => {
  it('shows each round with its call, arguments, result and reasoning', () => {
    render(<ToolRoundsView rounds={[round(), round({ index: 2, reasoning: '', content: 'Also Odette.' })]} />);

    const rounds = screen.getAllByRole('group');
    expect(rounds).toHaveLength(2);
    const first = within(rounds[0]);
    expect(first.getByText('Tool Round 1')).toBeTruthy();
    expect(first.getByText('Bram is here, so I fetch him.')).toBeTruthy();
    expect(first.getByText('get_entity')).toBeTruthy();
    expect(within(first.getByTestId('tool-call-arguments')).getByText(/"Bram"/)).toBeTruthy();
    expect(within(first.getByTestId('tool-call-result')).getByText(/The ferryman\./)).toBeTruthy();
    // A round without reasoning shows no empty reasoning block; its content shows instead.
    const second = within(rounds[1]);
    expect(second.queryByText('Reasoning')).toBeNull();
    expect(second.getByText('Also Odette.')).toBeTruthy();
  });

  it('highlights JSON arguments and results', async () => {
    render(<ToolRoundsView rounds={[round()]} />);
    const args = screen.getByTestId('tool-call-arguments');
    const result = screen.getByTestId('tool-call-result');
    await waitFor(() => expect(args.querySelector('.tok-string')).not.toBeNull());
    expect(result.querySelector('.tok-string')).not.toBeNull();
  });

  it('shows a result that is not JSON as plain text', () => {
    render(<ToolRoundsView rounds={[round({ calls: [{ id: '000000001', name: 'note', arguments: '', result: 'Bram rows.' }] })]} />);
    const result = screen.getByTestId('tool-call-result');
    expect(result.textContent).toBe('Bram rows.');
    expect(result.querySelector('[class*="tok-"]')).toBeNull();
  });

  it('marks a failed call with why it failed', () => {
    render(<ToolRoundsView rounds={[round({
      calls: [{ id: '000000001', name: 'get_weather', arguments: '{}', result: '{"error":"Unknown Tool"}', failure: 'unknown' }],
    })]} />);
    expect(screen.getByText('Unknown Tool')).toBeTruthy();
  });
});
