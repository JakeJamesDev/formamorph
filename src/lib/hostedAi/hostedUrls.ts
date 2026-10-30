import { API_BASE_URL } from '@/lib/apiBase';

/** The proxy's chat-completions route, or '' on a build with no community server. */
export const HOSTED_CHAT_URL = API_BASE_URL ? `${API_BASE_URL}/hosted-ai/chat/completions` : '';

/** Whether a chat URL is Formamorph AI's, which is never probed. */
export const isHostedChatUrl = (url: string): boolean => HOSTED_CHAT_URL !== '' && url === HOSTED_CHAT_URL;

/** The account's hosted-state route. */
export const HOSTED_STATE_URL = API_BASE_URL ? `${API_BASE_URL}/hosted-ai/state` : '';

/** The route that acknowledges one usage warning for the month, or '' with no community server. */
export const hostedAckUrl = (threshold: number): string =>
  API_BASE_URL ? `${API_BASE_URL}/hosted-ai/warnings/${threshold}/ack` : '';

/** The header that carries a turn's server-issued id, both ways. */
export const TURN_HEADER = 'X-Formamorph-Turn';
