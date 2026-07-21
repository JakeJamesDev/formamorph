import { describe, it, expect } from 'vitest';
import { buildScanCorpus, scannableMessageText } from './dictionaryScan';
import type { ChatMessage } from '@/types';

const msg = (role: ChatMessage['role'], content: string): ChatMessage => ({ role, content });

const base = {
  template: '<LOCATION|markdown>\n<ENTITIES|markdown>',
  ctx: {
    '<LOCATION>': 'plain location',
    '<LOCATION|markdown>': '- **Vault**\n  - **description:** a deep vault',
    '<ENTITIES>': 'plain entities',
    '<ENTITIES|markdown>': '- **Rustjaw**\n  - **description:** a scavenger',
  } as Record<string, string>,
  action: 'I open the door',
  notes: 'remember the key',
  history: [] as ChatMessage[],
};

describe('scannableMessageText', () => {
  it('returns an assistant turn as its narration, not the stored JSON envelope', () => {
    const stored = JSON.stringify({ game_text: 'A ghost drifts past.', turnId: 'abc-123' });
    expect(scannableMessageText(msg('assistant', stored))).toBe('A ghost drifts past.');
  });

  it('passes user messages through unchanged', () => {
    expect(scannableMessageText(msg('user', 'Player action: run'))).toBe('Player action: run');
  });

  it('falls back to the raw content when the turn is not parseable JSON', () => {
    expect(scannableMessageText(msg('assistant', 'legacy plain text'))).toBe('legacy plain text');
  });
});

describe('buildScanCorpus — scans exactly the blocks the prompt renders', () => {
  it('uses the rendered variant, not the base token', () => {
    const { scene } = buildScanCorpus(base);
    const regions = scene.map((s) => s.region);
    expect(regions).toContain('<ENTITIES|markdown>');
    expect(regions).not.toContain('<ENTITIES>');
    expect(scene.find((s) => s.region === '<ENTITIES|markdown>')!.text).toBe(base.ctx['<ENTITIES|markdown>']);
  });

  it('scans a summary variant as its summary — what the model was actually told', () => {
    const ctx = { ...base.ctx, '<ENTITIES|reachable.summary.markdown>': '- **Ser Halden**\n  - **description:** a knight' };
    const { scene } = buildScanCorpus({ ...base, template: '<ENTITIES|reachable.summary.markdown>', ctx });
    expect(scene.map((s) => s.region)).toContain('<ENTITIES|reachable.summary.markdown>');
  });

  it('includes every rendered scope block, not just the current one', () => {
    const ctx = {
      ...base.ctx,
      '<ENTITIES|sublocations.markdown>': 'sub entities',
      '<ENTITIES|reachable.summary.markdown>': 'reachable entities',
    };
    const template = '<ENTITIES|markdown>\n<ENTITIES|sublocations.markdown>\n<ENTITIES|reachable.summary.markdown>';
    const regions = buildScanCorpus({ ...base, template, ctx }).scene.map((s) => s.region);
    expect(regions).toEqual(expect.arrayContaining([
      '<ENTITIES|markdown>', '<ENTITIES|sublocations.markdown>', '<ENTITIES|reachable.summary.markdown>',
    ]));
  });

  it('excludes always-present scaffolding — world description, stats, traits, guidance', () => {
    const ctx = {
      ...base.ctx,
      '<WORLD DESCRIPTION>': 'the world',
      '<STATS DESCRIPTION|markdown>': 'Health 10/100',
      '<TRAITS DESCRIPTION|markdown>': 'Brave',
      '<LENGTH GUIDANCE>': 'write 3 paragraphs',
      '<MARKDOWN GUIDANCE>': 'use markdown',
    };
    const template = '<WORLD DESCRIPTION>\n<STATS DESCRIPTION|markdown>\n<TRAITS DESCRIPTION|markdown>\n<LENGTH GUIDANCE>\n<MARKDOWN GUIDANCE>\n<ENTITIES|markdown>';
    const regions = buildScanCorpus({ ...base, template, ctx }).scene.map((s) => s.region);
    expect(regions).toEqual(['<ENTITIES|markdown>', 'action', 'notes']);
  });

  it('scans a block only once even when the template repeats its token', () => {
    const template = '<ENTITIES|markdown>\nlater again:\n<ENTITIES|markdown>';
    const regions = buildScanCorpus({ ...base, template }).scene.map((s) => s.region);
    expect(regions.filter((r) => r === '<ENTITIES|markdown>')).toHaveLength(1);
  });

  it('skips tokens the template never renders and blocks that resolved to empty', () => {
    const { scene } = buildScanCorpus({ ...base, ctx: { ...base.ctx, '<ENTITIES|markdown>': '' } });
    expect(scene.map((s) => s.region)).not.toContain('<ENTITIES|markdown>');
    expect(scene.map((s) => s.region)).not.toContain('<LOCATION>'); // base never rendered
  });

  it('includes the action and notes, and drops them when empty', () => {
    expect(buildScanCorpus(base).scene.map((s) => s.region)).toEqual(
      expect.arrayContaining(['action', 'notes']),
    );
    const bare = buildScanCorpus({ ...base, action: '', notes: '' }).scene.map((s) => s.region);
    expect(bare).not.toContain('action');
    expect(bare).not.toContain('notes');
  });

  it('renders history as parsed narration, indexed oldest→newest', () => {
    const history = [
      msg('assistant', JSON.stringify({ game_text: 'A ghost drifts.', turnId: 'x' })),
      msg('user', 'Player action: flee'),
    ];
    expect(buildScanCorpus({ ...base, history }).history).toEqual([
      { region: 'history:0', text: 'A ghost drifts.' },
      { region: 'history:1', text: 'Player action: flee' },
    ]);
  });
});
