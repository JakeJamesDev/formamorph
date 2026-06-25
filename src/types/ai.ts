import type { WorldMetadata } from './world';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** OpenAI-compatible chat-completion request body. */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  stream?: boolean;
  stop?: string[];
}

/** A streamed chunk (SSE `data:` payload) from an OpenAI-compatible endpoint. */
export interface ChatCompletionChunk {
  choices: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
}

/** Kinds of AI request the game makes (thinking is the optional planning pass; locationChange is v1.2.0). */
export type AIRequestType = 'thinking' | 'gametext' | 'choices' | 'statUpdates' | 'locationChange';

/** Structured payload the game stores per turn (mirrors the JSON the app round-trips). */
export interface AITurnResult {
  game_text: string;
  choices: string[];
  stat_changes: Array<Record<string, number>>;
}

export interface AuthUser {
  username: string;
  [key: string]: unknown;
}

export interface AuthResponse {
  token: string;
  user?: AuthUser;
  message?: string;
}

/** Result of a paginated remote-worlds fetch (see WorldStorageService.fetchRemoteWorlds). */
export interface RemoteWorldsResponse {
  success: boolean;
  data?: WorldMetadata[];
  total?: number;
  error?: string;
}
