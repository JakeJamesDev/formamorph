import type { HelpExchange } from '@/components/formaquestion/useHelpChat';
import type { DocsIndex } from '@/lib/docs/docsIndex';
import { traceSection, type HelpTrace } from '@/lib/formaquestion/helpTrace';

/**
 * A canned help question with a trace, for `#dev?modal=formaquestionAiContext`: the AI Context popup has
 * something to draw without an AI. The sections come from the loaded guide, so every link resolves. The
 * route seeds two, so the dialog shows its pager.
 */
export function devHelpTraceSample(index: DocsIndex, question = 'How do I add a trait?', id = 'dev-trace'): HelpExchange {
  const keyword = index.search(question, 6).map(traceSection);
  const picks = index.search('trait', 3).map(traceSection);
  const merged = [...new Map([...keyword, ...picks].map((section) => [section.id, section])).values()];
  const sent = merged.slice(0, 3);
  const endpoint = { preset: 'Default', routed: false, model: 'default', url: 'https://api.example.com/v1/chat/completions', reasoningFields: [], maxTokens: 800 };
  const trace: HelpTrace = {
    surface: 'World Editor screen, Traits tab',
    openScreen: true,
    lead: sent[0],
    preset: 'Default',
    search: {
      on: ['keyword', 'aiPicks'],
      queries: [{ query: question, sources: [{ source: 'keyword', sections: keyword }, { source: 'aiPicks', sections: picks }], merged }],
      pick: null,
    },
    sent,
    requests: [
      {
        record: {
          type: 'AI Search',
          messages: [{ role: 'system', content: 'Pick the guide sections that answer the question.' }, { role: 'user', content: `<sections>\n…\n</sections>\n\nQuestion: ${question}` }],
          response: picks.map((section) => `${section.page} › ${section.label}`).join('\n'),
          endpoint: { ...endpoint, maxTokens: 150 },
        },
        samplers: { temperature: 0.2, repetitionPenalty: 1 },
        customPrompt: false,
      },
      {
        record: {
          type: 'Answer',
          messages: [{ role: 'system', content: 'Answer from the guide sections.' }, { role: 'user', content: `<guide>\n…\n</guide>\n\nQuestion: ${question}` }],
          response: '1. Open the **Traits** tab.\n2. Select **Add Trait**.',
          reasoning: 'The player asks how to add a trait. The Traits page has the steps.',
          endpoint,
        },
        samplers: { temperature: 0.2, repetitionPenalty: 1 },
        customPrompt: true,
      },
    ],
  };
  return { id, question, images: [], answer: '1. Open the **Traits** tab.\n2. Select **Add Trait**.', reasoning: '', status: 'answered', sources: [], flagged: false, nearest: [], trace };
}
