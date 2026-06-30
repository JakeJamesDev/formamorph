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

/**
 * Kinds of AI request the game makes (thinking is the optional planning pass; director/character/
 * storyboard are the staged planning pipeline; locationChange is v1.2.0; summary is the lazy per-turn
 * memory digest).
 */
export type AIRequestType =
  | 'thinking'
  | 'director'
  | 'character'
  | 'storyboard'
  | 'gametext'
  | 'choices'
  | 'statUpdates'
  | 'locationChange'
  | 'summary';

/**
 * Structured payload the game stores per turn (mirrors the JSON the app round-trips).
 * `turnId`/`summary` are additive memory-digest fields — absent on pre-digest saves.
 */
export interface AITurnResult {
  game_text: string;
  choices: string[];
  stat_changes: Array<Record<string, number>>;
  /** Stable per-turn id (`crypto.randomUUID()`); powers the digest async-apply guard. */
  turnId?: string;
  /** Lazily-generated memory digest (typed fact lines) for this turn. */
  summary?: string;
  /** Names of the entities that took part in this turn (from the narration parse, plus staged ad-hoc
   *  characters confirmed by the narration). Drives the choices filter and participation rehydration. */
  entities?: string[];
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
