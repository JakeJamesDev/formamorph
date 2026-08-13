import { describe, it, expect } from 'vitest';
import { classifyTurnError, UNPARSEABLE_MESSAGE } from './turnErrors';
import { AiStreamError } from '@/lib/aiRequest/aiStream';

describe('classifyTurnError', () => {
  it('names a network-layer failure', () => {
    // A fetch that never reached a server rejects with a TypeError, whatever the cause.
    expect(classifyTurnError(new TypeError('Failed to fetch'))).toBe('connection');
  });

  it('names the two HTTP statuses the guidance distinguishes', () => {
    expect(classifyTurnError(Object.assign(new Error('nope'), { response: { status: 404 } }))).toBe('notFound');
    expect(classifyTurnError(Object.assign(new Error('nope'), { response: { status: 400 } }))).toBe('badRequest');
  });

  it('reads a status the stream carries on the error itself', () => {
    expect(classifyTurnError(new AiStreamError('http', 'Not Found', { status: 404 }))).toBe('notFound');
  });

  it('names an unreadable answer', () => {
    expect(classifyTurnError(new Error(UNPARSEABLE_MESSAGE))).toBe('parse');
  });

  it('reads a refusal by its status, not by what its body said', () => {
    // A 500 whose message happens to match is still the endpoint refusing, not an unreadable answer.
    const refused = Object.assign(new Error(UNPARSEABLE_MESSAGE), { response: { status: 500 } });
    expect(classifyTurnError(refused)).toBe('unknown');
  });

  it('falls back to unknown for anything else', () => {
    expect(classifyTurnError(new Error('boom'))).toBe('unknown');
    expect(classifyTurnError(Object.assign(new Error('teapot'), { response: { status: 418 } }))).toBe('unknown');
    expect(classifyTurnError(null)).toBe('unknown');
    expect(classifyTurnError(undefined)).toBe('unknown');
    expect(classifyTurnError('a string')).toBe('unknown');
  });

  it('leaves the error untouched', () => {
    // The kind is the runner's answer, not a flag written back onto what was thrown.
    const error = new TypeError('Failed to fetch');
    const before = Object.keys(error);
    classifyTurnError(error);
    expect(Object.keys(error)).toEqual(before);
  });
});
