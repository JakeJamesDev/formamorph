import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiContextRequestCard, type AiContextCardSection, type AiContextTextSlot } from './AiContextRequestCard';
import type { AiRequestRecord } from '@/lib/aiContext/requestRecord';

/** A record with none of the game-only fields: what a Formaquestion request would carry. */
const record: AiRequestRecord = {
  type: 'answer',
  messages: [
    { role: 'system', content: 'You answer questions about the app.' },
    { role: 'user', content: 'How do I save a game?' },
  ],
  response: 'Open the menu and choose Save.',
  reasoning: 'The player asks about saving.',
  toolRounds: [{
    index: 1, messages: [], reasoning: '', content: '', finishReason: 'tool_calls',
    calls: [{ id: 'c1', name: 'lookup_guide', arguments: '{}', result: 'Saving: open the menu.' }],
  }],
  endpoint: { preset: 'Cloud', routed: true, model: 'big-24b', url: 'https://api.example.com/v1', reasoningFields: [], maxTokens: 800 },
};

const allOpen = () => true;

describe('AiContextRequestCard', () => {
  it('draws every section of a record that has no game-only field', () => {
    render(<AiContextRequestCard record={record} index={0} isOpen={allOpen} onOpenChange={() => {}} />);
    expect(screen.getByText('Request 1: answer')).toBeTruthy();
    expect(screen.getByText('→ Cloud · big-24b')).toBeTruthy();
    expect(screen.getByText('Max Tokens 800')).toBeTruthy();
    for (const title of ['Raw Input', 'Tool Rounds', 'Raw Reasoning', 'Raw Output']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    expect(screen.getByText('You answer questions about the app.')).toBeTruthy();
    expect(screen.getByText('The player asks about saving.')).toBeTruthy();
    expect(screen.getByText('Open the menu and choose Save.')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Tool Round 1' })).toBeTruthy();
  });

  it('leaves out the sections the record does not carry', () => {
    const bare: AiRequestRecord = { type: 'pick', messages: [{ role: 'user', content: 'Which section?' }] };
    render(<AiContextRequestCard record={bare} index={2} isOpen={allOpen} onOpenChange={() => {}} />);
    expect(screen.getByText('Request 3: pick')).toBeTruthy();
    expect(screen.getByText('Raw Input')).toBeTruthy();
    expect(screen.queryByText('Tool Rounds')).toBeNull();
    expect(screen.queryByText('Raw Reasoning')).toBeNull();
    expect(screen.queryByText('Raw Output')).toBeNull();
  });

  it('reports which section a click opens or closes, and draws only the sections the caller opens', () => {
    const onOpenChange = vi.fn<(section: AiContextCardSection, open: boolean) => void>();
    const isOpen = (section: AiContextCardSection) => section !== 'output';
    render(<AiContextRequestCard record={record} index={0} isOpen={isOpen} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('Open the menu and choose Save.')).toBeNull();
    fireEvent.click(screen.getByText('Raw Output'));
    expect(onOpenChange).toHaveBeenLastCalledWith('output', true);
    fireEvent.click(screen.getByText('Raw Reasoning'));
    expect(onOpenChange).toHaveBeenLastCalledWith('reasoning', false);
    fireEvent.click(screen.getByText('Request 1: answer'));
    expect(onOpenChange).toHaveBeenLastCalledWith('group', false);
  });

  it('hands every text slice to the highlighter with the slot it fills', () => {
    const renderText = vi.fn((text: string, _slot: AiContextTextSlot) => <mark>{text}</mark>);
    render(<AiContextRequestCard record={record} index={0} isOpen={allOpen} onOpenChange={() => {}} renderText={renderText} />);
    const slots = renderText.mock.calls.map(([, slot]) => slot);
    expect(slots).toEqual(expect.arrayContaining([
      { part: 'input', blockIndex: 0, start: 0 },
      { part: 'input', blockIndex: 1, start: 0 },
      { part: 'reasoning', blockIndex: 0, start: 0 },
      { part: 'output', blockIndex: 0, start: 0 },
    ]));
    expect(screen.getByText('Open the menu and choose Save.').tagName).toBe('MARK');
  });

  it("draws the caller's chips after the endpoint chips", () => {
    render(<AiContextRequestCard record={record} index={0} isOpen={allOpen} onOpenChange={() => {}} chips={<span>Custom Prompt</span>} />);
    const header = screen.getByText('Request 1: answer').parentElement!;
    const texts = [...header.querySelectorAll('span')].map((span) => span.textContent);
    expect(texts.indexOf('Custom Prompt')).toBeGreaterThan(texts.indexOf('Max Tokens 800'));
  });

  it('says so when a search folds the card', () => {
    render(<AiContextRequestCard record={record} index={0} folded isOpen={() => false} onOpenChange={() => {}} />);
    expect(screen.getByText('· no matches')).toBeTruthy();
  });
});
