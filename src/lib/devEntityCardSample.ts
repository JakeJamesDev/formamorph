import type { HelpExchange } from '@/components/formaquestion/useHelpChat';

const ANSWER = `Here are two people for the gate:

\`\`\`entity
Name: Maren Holt
AI Description: A gate guard in her fifties who knows every face in town. She is polite to strangers and never takes a bribe.
\`\`\`

\`\`\`entity
Name: Pell Ashby
AI Description: A salt merchant who waits at the gate each morning for the caravans. He trades gossip as freely as salt.
\`\`\`

This one doesn't follow the format, so it shows as a code block:

\`\`\`entity
Name: Odd Wick
Type: lamplighter
AI Description: Keeps the harbor lamps lit.
\`\`\``;

/** A finished answer with two entity cards and one invalid block, for `#dev?modal=formaquestion&fixture=entityCards`. */
export function devEntityCardSample(): HelpExchange {
  return {
    id: 'dev-entity-cards',
    question: 'Make me two people for the town gate.',
    images: [],
    answer: ANSWER,
    answerStarted: true,
    reasoning: '',
    status: 'answered',
    sources: [],
    flagged: false,
    nearest: [],
  };
}
