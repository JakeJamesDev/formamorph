import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { EMBEDDING_MODEL_ID } from '@/lib/memoryRelevance';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { pastPicks } from '@/test/helpFixtures';
import { DOCS_LOOKUP } from './docsLookup';
import type { HelpEmbedder } from './helpSemantic';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf } from './helpSettings';
import { encodeVector, sectionTexts, type SectionVectorsFile } from './sectionVectors';

const PAGES = {
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
  Library: '# 📚 Library\n\nThe library holds worlds.\n\n## How to Make a Folder\n\n1. Select **New Folder**.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Traits](Traits)\n- [Library](Library)\n' });

const reasoning: ReasoningCapability = { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } };
const CAPABLE = textSnapshot(textTarget({ reasoning }));

/** The frames of a reply that calls the lookup once. */
const callFrames = (args: unknown): string[] => [
  sseFrame({ tool_calls: [{ index: 0, id: 'srv-0', type: 'function', function: { name: DOCS_LOOKUP.name, arguments: JSON.stringify(args) } }] }),
  sseFrame({}, 'tool_calls'),
  'data: [DONE]\n\n',
];

/** A fetch that answers request N with the Nth reply. */
const script = (...replies: string[][]) => {
  let request = 0;
  return vi.fn(async () => sseResponse(replies[request++]));
};

const file: SectionVectorsFile = {
  model: EMBEDDING_MODEL_ID,
  dims: 2,
  sections: sectionTexts(index).map(({ section, hash }) => ({ id: section.id, hash, vector: encodeVector(Float32Array.of(1, 0)) })),
};
const embedder: HelpEmbedder = { open: async () => true, embed: async (texts) => texts.map(() => Float32Array.of(1, 0)), vectors: async () => file };

/** The events of a question, with the trace events left out. */
async function collect(question: HelpQuestion): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of askHelp(question)) if (event.type !== 'trace') all.push(event);
  return all;
}

const stagesOf = (events: HelpEvent[]) => events.flatMap((event) => (event.type === 'stage' ? [event.stage] : []));

describe('the stages of a help question', () => {
  it('names the pick request, then the wait for the answer', async () => {
    const fetchImpl = pastPicks(script(sseReply('Select **Add Trait**.')));
    const events = await collect({ question: 'How do I add a trait?', settings: helpSettingsOf(), snapshot: CAPABLE, index, fetchImpl });
    expect(stagesOf(events)).toEqual(['picking', 'waiting']);
    // The wait starts before the first answer text.
    expect(events.map((event) => event.type)).toEqual(['stage', 'stage', 'answer', 'done']);
  });

  it('names the semantic search when the picks are off', async () => {
    const fetchImpl = pastPicks(script(sseReply('Select **Add Trait**.')));
    const settings = helpSettingsOf({ sources: { keyword: true, aiPicks: false, semantic: true } });
    const events = await collect({ question: 'How do I add a trait?', settings, snapshot: CAPABLE, index, fetchImpl, embedder });
    expect(stagesOf(events)).toEqual(['searching', 'waiting']);
  });

  it('skips the search stage when only the instant keyword search runs, and on a bare question', async () => {
    const keyword = helpSettingsOf({ sources: { keyword: true, aiPicks: false, semantic: false } });
    const keywordEvents = await collect({ question: 'How do I add a trait?', settings: keyword, snapshot: CAPABLE, index, fetchImpl: script(sseReply('Select **Add Trait**.')) });
    expect(stagesOf(keywordEvents)).toEqual(['waiting']);

    const bare = helpSettingsOf({ sources: { keyword: false, aiPicks: false, semantic: false }, openScreen: false, lookup: false });
    const bareEvents = await collect({ question: 'How do I add a trait?', settings: bare, snapshot: CAPABLE, index, fetchImpl: script(sseReply('A trait is a tag.')) });
    expect(stagesOf(bareEvents)).toEqual(['waiting']);
  });

  it('names the lookup during a tool round, then waits for the next round', async () => {
    const fetchImpl = pastPicks(script(callFrames({ sections: 'Library#how-to-make-a-folder' }), sseReply('Select **New Folder**.')));
    const events = await collect({ question: 'How do I make a folder?', settings: helpSettingsOf({ lookup: true }), snapshot: CAPABLE, index, fetchImpl });
    expect(stagesOf(events)).toEqual(['picking', 'waiting', 'lookingUp', 'waiting']);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Select **New Folder**.' });
  });
});
