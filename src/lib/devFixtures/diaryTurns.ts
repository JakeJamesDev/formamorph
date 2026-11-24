// Canned turns with memories, character diaries and a script diary line, for `fixture=diaries`.
import { serializeTurnContent } from '@/lib/turnDigest';
import type { ChatMessage } from '@/types';

interface CannedTurn {
  action: string;
  narration: string;
  summary: string;
  entities: string[];
  diaries: Record<string, string>;
  codeDiaries?: Record<string, string[]>;
}

const TURNS: CannedTurn[] = [
  {
    action: 'START GAME',
    narration: 'The white room hums. Bram stands by the console with a hand on the wand at his hip. Wick leans in the doorway, breathing hard, as if he ran the whole way here.',
    summary: 'Sable woke in the white room with Bram guarding the console and Wick arriving out of breath.',
    entities: ['Bram', 'Wick'],
    diaries: {
      Bram: 'Another stranger in the room I swore to keep. I will watch Sable before I trust her.',
      Wick: 'Made it before the doors sealed. Nobody asked where I came from, which suits me.',
    },
  },
  {
    action: 'I ask Bram what the console does.',
    narration: 'Bram studies you for a long moment. "It answers to the oath," he says, "and the oath answers to me." He does not step aside.',
    summary: 'Bram refused to explain the console and claimed it answers to his oath.',
    entities: ['Bram'],
    diaries: { Bram: 'She asked about the console first. Everyone does. I gave her nothing.' },
  },
  {
    action: 'I offer Wick some water.',
    narration: 'Wick takes the flask and drinks half of it in one go. "Thanks," he mutters, and slips you a folded note when Bram looks away.',
    summary: 'Wick accepted water from Sable and secretly passed her a folded note.',
    entities: ['Wick', 'Bram'],
    diaries: {
      Wick: 'Sable shared her water without being asked. I gave her the note. If Bram finds out, I am finished.',
      Bram: 'nothing notable',
    },
  },
  {
    action: 'I read the note quietly.',
    narration: 'The note holds three words in a shaky hand: "He lies. Basement." You fold it again before anyone notices.',
    summary: 'The note from Wick warned that Bram lies and pointed to a basement.',
    entities: ['Wick'],
    diaries: { Wick: 'She read it. I saw her hands go still. Now we wait.' },
  },
  {
    action: 'I ask Bram if there is a basement.',
    narration: 'Bram goes very quiet. "There is no basement," he says, too quickly. His thumb taps the wand twice.',
    summary: 'Bram denied that a basement exists, nervously and too fast.',
    entities: ['Bram', 'Wick'],
    diaries: {
      Bram: 'She knows about the basement. Someone told her. Wick has been too quiet since he arrived.',
      Wick: 'nothing notable',
    },
    codeDiaries: { Bram: ['My oath grows heavier.'] },
  },
  {
    action: 'I keep talking to Bram, friendly.',
    narration: 'You talk about nothing in particular: the weather outside, the hum of the room. Slowly Bram\'s shoulders drop. He almost smiles once.',
    summary: 'Sable made small talk with Bram, and he relaxed a little.',
    entities: ['Bram'],
    diaries: { Bram: 'She talked to me like a person, not a lock. I had forgotten what that is like.' },
  },
  {
    action: 'I wait until Bram dozes off.',
    narration: 'Late in the evening, Bram\'s chin sinks to his chest. Wick catches your eye and points to a seam in the floor near the console.',
    summary: 'Bram fell asleep, and Wick showed Sable a hidden seam in the floor.',
    entities: ['Wick', 'Bram'],
    diaries: {
      Wick: 'The old guard finally slept. I showed her the seam. No going back now.',
      Bram: 'nothing notable',
    },
  },
  {
    action: 'I pry the seam open.',
    narration: 'The floor panel lifts with a sigh of cold air. Stairs lead down into the dark. Behind you, Bram stirs and says your name.',
    summary: 'Sable opened a hidden hatch to the basement just as Bram woke.',
    entities: ['Bram', 'Wick'],
    diaries: {
      Bram: 'I woke to the hatch open and her standing over it. I trusted her for one evening and this is what it cost.',
      Wick: 'Bram is awake. I should run. I am not going to.',
    },
  },
];

/** The canned history, as `fullMessageHistory` holds it. */
export function diaryHistory(): ChatMessage[] {
  return TURNS.flatMap((turn, i): ChatMessage[] => [
    { role: 'user', content: turn.action },
    {
      role: 'assistant',
      content: serializeTurnContent({
        narration: turn.narration, choices: [], stat_changes: [], turnId: `diary-turn-${i + 1}`,
        entities: turn.entities, summary: turn.summary, diaries: turn.diaries,
        ...(turn.codeDiaries ? { codeDiaries: turn.codeDiaries } : {}),
      }),
    },
  ]);
}

export const DIARY_LAST_NARRATION = TURNS[TURNS.length - 1].narration;
