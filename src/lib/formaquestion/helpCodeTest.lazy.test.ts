/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { pastPicks } from '@/test/helpFixtures';
import { HELP_CODE_TEST } from './helpCodeTest';
import { askHelp } from './helpSession';
import { helpSettingsOf } from './helpSettings';

// Each factory runs when its module is first imported, so the counts say what the help bundle has loaded.
const loaded = vi.hoisted(() => ({ executor: 0, analysis: 0 }));
vi.mock('@/lib/statCodeExecutor', async (actual) => {
  loaded.executor++;
  return actual();
});
vi.mock('@/lib/statCodeAnalysis', async (actual) => {
  loaded.analysis++;
  return actual();
});

const index = createDocsIndex({ pages: { StatCodeGuide: '# Stat Code\n\nCode sets a stat.\n' } });
const snapshot = textSnapshot(textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } }));

const replies = (...scripted: string[][]) => {
  let request = 0;
  return vi.fn(async () => sseResponse(scripted[request++]));
};

const ask = async (fetchImpl: ReturnType<typeof replies>) => {
  const question = 'Write stat code that sets my Courage to 5.';
  for await (const _event of askHelp({ question, settings: helpSettingsOf({ mascot: false, codeTest: true }), snapshot, index, fetchImpl: pastPicks(fetchImpl) })) { /* drain */ }
};

describe('the code test bundle boundary', () => {
  it('loads neither the sandbox engine nor the analysis until the first call', async () => {
    await ask(replies(sseReply('self.value = 5;')));
    expect(loaded).toEqual({ executor: 0, analysis: 0 });

    const call = sseFrame({ tool_calls: [{ index: 0, id: 'srv-0', type: 'function', function: { name: HELP_CODE_TEST.name, arguments: JSON.stringify({ code: 'self.value = 5;', box: 'before', stat: 'Courage' }) } }] });
    await ask(replies([call, sseFrame({}, 'tool_calls'), 'data: [DONE]\n\n'], sseReply('self.value = 5;')));
    expect(loaded).toEqual({ executor: 1, analysis: 1 });
  });
});
