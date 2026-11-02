import type { Intent } from '@/types';

export const INTENTS: readonly Intent[] = ['Chat', 'Help', 'Code', 'World', 'Create'];

/** The Intents a Formaquestion Tool with no list goes to. */
export const DEFAULT_TOOL_INTENTS: readonly Intent[] = ['Help', 'Code', 'World'];

/** The Intents that send `tool`: its list, or the default when it has none. */
export const toolIntents = (tool: { intents?: readonly Intent[] }): readonly Intent[] => tool.intents ?? DEFAULT_TOOL_INTENTS;
