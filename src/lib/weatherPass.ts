import type { WeatherKind } from '@/types';
import type { ResponseSchema } from '@/lib/aiRequest/responseSchema';
import { parseJsonReply } from '@/lib/aiRequest/jsonReply';

/** The Weather Pass's answer for a turn that leaves the weather as it was. */
export const NO_WEATHER_CHANGE = 'no change';

/** How the pass names each kind, in its request and in its reply. */
export const WEATHER_ANSWER_WORDS: Record<WeatherKind, string> = {
  clear: 'clear', rain: 'rain', snow: 'snow', storm: 'storm', brightSun: 'bright sun',
};

/** The pass's input beyond the narration: the weather before the turn (null on the page-one read) and the
 *  kinds it may answer with. */
export interface WeatherPassOffer {
  current: WeatherKind | null;
  offered: readonly WeatherKind[];
}

const answerList = (offered: readonly WeatherKind[]): string[] =>
  [NO_WEATHER_CHANGE, ...offered.map((kind) => WEATHER_ANSWER_WORDS[kind])];

const beforeLine = (current: WeatherKind | null): string =>
  (current ? `\n\nThe weather before this passage: ${WEATHER_ANSWER_WORDS[current]}.` : '');

/** The gate the pass answers before the kind: does the scene itself show the weather (page one) or its change? */
const shownRule = (current: WeatherKind | null): string =>
  (current
    ? 'yes when the narrator shows the sky or the air around the character changing during this passage. no when it stays as it was, or when weather appears only in what someone says, remembers or compares.'
    : 'yes when the narrator shows weather in the sky or the air around the character. no when it shows none, or when weather appears only in what someone says, remembers or compares.');

/** The text request's reply format, which rides after the user message out of the author's reach. */
export const weatherTextFormat = ({ current, offered }: WeatherPassOffer): string =>
  `${beforeLine(current)}

First write ${shownRule(current)} Then name the weather at the end of the passage, one of: ${answerList(offered).join(', ')}.

Your entire reply is one line: yes or no, a dash, then that weather, with nothing before or after it.`;

/** The schema request's reply format, which describes its two fields. */
export const weatherSchemaFormat = ({ current, offered }: WeatherPassOffer): string =>
  `${beforeLine(current)}

Answer with two fields:
- shown: ${shownRule(current)}
- weather: ${NO_WEATHER_CHANGE}, or the weather at the end of the passage. The choices are: ${answerList(offered).join(', ')}.`;

/** The pass's reply schema: the yes/no gate, then one enum field over the offered answers. */
export const weatherPassSchema = (offered: readonly WeatherKind[]): ResponseSchema => ({
  name: 'weather',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['shown', 'weather'],
    properties: { shown: { type: 'string', enum: ['yes', 'no'] }, weather: { type: 'string', enum: answerList(offered) } },
  },
});

const kindOfWord = (word: string, offered: readonly WeatherKind[]): WeatherKind | null =>
  offered.find((kind) => WEATHER_ANSWER_WORDS[kind] === word) ?? null;

const normalized = (text: string): string => text.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The kind a text reply names: the whole reply, else the earliest answer word in it. Null for no change. */
function textAnswer(raw: string, offered: readonly WeatherKind[]): WeatherKind | null {
  const text = normalized(raw);
  if (text === NO_WEATHER_CHANGE) return null;
  const whole = kindOfWord(text, offered);
  if (whole) return whole;
  let best: { at: number; kind: WeatherKind | null } | null = null;
  for (const word of answerList(offered)) {
    const at = ` ${text} `.indexOf(` ${word} `);
    if (at >= 0 && (!best || at < best.at)) best = { at, kind: kindOfWord(word, offered) };
  }
  return best?.kind ?? null;
}

/** The kind the pass answered, from either request, or null for no change. A "no" gate, or an answer outside
 *  the offered set, reads as no change. */
export function parseWeatherReply(raw: string, offered: readonly WeatherKind[]): WeatherKind | null {
  const parsed = parseJsonReply(raw);
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    const { shown, weather } = parsed as Record<string, unknown>;
    if (shown === 'no') return null;
    return typeof weather === 'string' ? kindOfWord(normalized(weather), offered) : null;
  }
  const gate = normalized(raw).match(/^(yes|no)\b(?! change)/);
  if (gate?.[1] === 'no') return null;
  return textAnswer(gate ? normalized(raw).slice(gate[0].length) : raw, offered);
}
