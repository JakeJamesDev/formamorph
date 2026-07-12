import type { WorldMetadata } from './world';

/** Sender role of a chat message, matching the OpenAI chat-completion roles. */
export type ChatRole = 'system' | 'user' | 'assistant';

/** A single chat-completion message: who sent it and its text. */
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
  | 'narration'
  | 'choices'
  | 'statUpdates'
  | 'locationChange'
  | 'summary'
  | 'diary'
  | 'discoverEntity';

/**
 * Structured payload the game stores per turn (mirrors the JSON the app round-trips).
 * `turnId`/`summary` are additive memory-digest fields — absent on pre-digest saves.
 */
export interface AITurnResult {
  narration: string;
  choices: string[];
  stat_changes: Array<Record<string, number>>;
  /** Stable per-turn id (`crypto.randomUUID()`); powers the digest async-apply guard. */
  turnId?: string;
  /** Lazily-generated memory digest (a short condensed retelling) for this turn. */
  summary?: string;
  /** Names of the entities that took part in this turn (from the narration parse, plus staged ad-hoc
   *  characters confirmed by the narration). Drives the choices filter and participation rehydration. */
  entities?: string[];
  /** Lazily-generated per-character diary: character name → that character's first-person entry about
   *  this turn. Written for each participant as turns age out; a character's full diary is these across
   *  turns. Absent on pre-diary saves. */
  diaries?: Record<string, string>;
  /** The location this turn took place at, so a runtime-discovered character joins the right roster. */
  locationId?: string;
  /** The player's notes as they were for this turn — frozen from the live scratchpad when the turn commits,
   *  so paging back shows (and can edit) that turn's notes. Absent on pre-per-turn-notes saves → the view
   *  falls back to the snapshot's global `playerNotes`. */
  notes?: string;
  /** A reasoning model's (or inline-thinking) private scratchpad for this turn, shown as a collapsible aside
   *  above the narration. `ms` is the think duration. Absent when the model didn't reason / on pre-2.1.0 saves. */
  reasoning?: { text: string; ms: number };
}

/** An authenticated account as returned by the auth server; extra server fields pass through the index signature. */
export interface AuthUser {
  username: string;
  [key: string]: unknown;
}

/** Auth server reply carrying the session `token` and, on success, the user. */
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
