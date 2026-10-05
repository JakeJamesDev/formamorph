import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderHelpPrompt } from '@/lib/formaquestion/helpChips';
import { DEFAULT_HELP_PROMPTS, HELP_PICK_SYSTEM_PROMPT } from '@/lib/formaquestion/helpPrompt';
import { DEFAULT_MASCOT_RIG, type MascotRig } from '@/lib/formaquestion/mascot';
import type { MascotPresetStore } from '@/lib/formaquestion/mascotPresets';
import { writeStoredWindow } from '@/lib/formaquestion/windowBox';
import type { Tool } from '@/types';
import { sseReply, sseResponse } from './aiTextFixtures';

/** The default answer prompt as a player who changed nothing sends it: the mascot on, with the default Voice. */
export const VOICED_HELP_PROMPT = renderHelpPrompt(DEFAULT_HELP_PROMPTS.answer, { voice: DEFAULT_MASCOT_RIG.voice });

/** The default lookup prompt as a player who changed nothing sends it. */
export const VOICED_LOOKUP_PROMPT = renderHelpPrompt(DEFAULT_HELP_PROMPTS.lookup, { voice: DEFAULT_MASCOT_RIG.voice });

/** Stores the window's place, with one size for both chromes. */
export function storeWindowBox({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  writeStoredWindow({ x, y, minimal: { w, h }, full: { w, h }, bubble: null, chat: null });
}

/** Stores help settings with the Mascot off, so the window has the framed chrome. Fields pass as given, bad ones included. */
export function storeFramedWindow(fields: Record<string, unknown> = {}) {
  localStorage.setItem('FORMAMORPH_helpSettings', JSON.stringify({ mascot: false, ...fields }));
}

/** Stores help settings with the Chat Style pinned to Minimal, so the window shows the whole conversation as a column. */
export function storeMinimalWindow(fields: Record<string, unknown> = {}) {
  localStorage.setItem('FORMAMORPH_helpSettings', JSON.stringify({ chatStyle: 'minimal', ...fields }));
}

/** A Formaquestion Tool: an entity lookup by name, offered to no prompt, with `patch` applied. */
export const helpTool = (patch: Partial<Tool> = {}): Tool => ({
  id: 'h-1', name: 'find_person', description: 'Finds a person of the world by name.',
  params: [{ name: 'name', type: 'string', description: 'The name.', required: true, options: [] }],
  handler: { kind: 'lookup', source: 'entities', param: 'name', returns: 'full' }, emptyResult: '{"matches": []}', offeredTo: [], ...patch,
});

type Responder = (url: string, init: RequestInit) => Response | Promise<Response>;

/** A pick reply that copies no line of the list, so the other search sources alone find the sections. */
export const NO_PICK = 'No section of the list answers the question.';

/** Whether a request is the pick request of a help question. */
export const isPickRequest = (init: RequestInit): boolean =>
  (JSON.parse(init.body as string) as { messages: { content: unknown }[] }).messages[0].content === HELP_PICK_SYSTEM_PROMPT;

/**
 * The endpoint of a help question, for `fetchImpl`: the pick request gets `picked` as the model's reply, and
 * every other request goes to `answers`. A test of the answer request reads `answers` alone.
 */
export const pastPicks = (answers: Responder, picked = NO_PICK): typeof fetch =>
  ((url: string, init: RequestInit) => (isPickRequest(init) ? sseResponse(sseReply(picked)) : answers(url, init))) as unknown as typeof fetch;

/**
 * Stubs the global fetch as the endpoint of a help question. The returned spy gets every request but the
 * pick request and answers it as `stubStream` does; its `picks` spy gets the pick requests.
 */
export function stubHelpStream(chunks: string[] | (() => Response), picked = NO_PICK) {
  const answers = vi.fn((_url: string, _init: RequestInit) => (typeof chunks === 'function' ? chunks() : sseResponse(chunks)));
  const picks = vi.fn((_url: string, _init: RequestInit) => sseResponse(sseReply(picked)));
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => (isPickRequest(init) ? picks(url, init) : answers(url, init)));
  return Object.assign(answers, { picks });
}

/** A store whose one custom mascot, "Mine", holds `rig` and is active. */
export const mascotStoreOf = (rig: MascotRig): MascotPresetStore => ({ activeId: 'mine', mascots: [{ id: 'mine', name: 'Mine', rig }] });

/** Opens Formaquestion Settings from the window's title bar menu. */
export async function openHelpSettings() {
  await userEvent.click(screen.getByRole('button', { name: 'More Actions' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Settings' }));
}
