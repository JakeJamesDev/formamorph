import { describe, it, expect } from 'vitest';
import type { Tool, ToolParam } from '@/types';
import { draftProblems, finishDraft, hasDraftProblems, renameParam, tryItArguments, withHandlerKind } from './toolDraft';

const param = (patch: Partial<ToolParam> = {}): ToolParam =>
  ({ name: 'name', type: 'string', description: '', required: true, options: [], ...patch });

const draft = (patch: Partial<Tool> = {}): Tool => ({
  id: 'd', name: 'find_person', description: '', params: [param()],
  handler: { kind: 'lookup', source: 'entities', param: 'name', returns: 'full' },
  emptyResult: '{"matches": []}', offeredTo: ['narration'], ...patch,
});

const mine = draft({ id: 'other', name: 'get_weather' });

describe('draftProblems', () => {
  it('finds nothing wrong with a well-formed draft', () => {
    const problems = draftProblems(draft(), [mine]);
    expect(problems).toEqual({ name: null, params: [null], handler: null });
    expect(hasDraftProblems(problems)).toBe(false);
  });

  it.each([
    ['a bad character', 'find person', 'format'],
    ['an empty name', '', 'format'],
    ['a name over 64 characters', 'x'.repeat(65), 'format'],
    ['another Tool’s name, in any case', 'GET_WEATHER', 'taken'],
    ['a catalog name', 'get_entity', 'builtin'],
  ])('blocks %s', (_, name, problem) => {
    const problems = draftProblems(draft({ name }), [mine]);
    expect(problems.name).toBe(problem);
    expect(hasDraftProblems(problems)).toBe(true);
  });

  it('accepts a 64-character name and the draft’s own saved name', () => {
    expect(draftProblems(draft({ name: 'x'.repeat(64) }), [mine]).name).toBeNull();
    expect(draftProblems(draft({ id: 'other', name: 'get_weather' }), [mine]).name).toBeNull();
  });

  it('flags an unnamed parameter, a repeated one and a list with no options', () => {
    const problems = draftProblems(draft({
      params: [param(), param({ name: '' }), param(), param({ name: 'mood', type: 'enum', options: [' ', ''] })],
    }), []);
    expect(problems.params).toEqual(['repeated', 'unnamed', 'repeated', 'noOptions']);
    expect(hasDraftProblems(problems)).toBe(true);
  });

  it('flags a lookup that searches by a parameter the Tool doesn’t have', () => {
    const problems = draftProblems(draft({ handler: { kind: 'lookup', source: 'entities', param: 'who', returns: 'full' } }), []);
    expect(problems.handler).toBe('lookupParam');
    expect(hasDraftProblems(problems)).toBe(true);
  });

  it('leaves Template and Script handlers alone', () => {
    expect(draftProblems(draft({ params: [], handler: { kind: 'template', body: '' } }), []).handler).toBeNull();
    expect(draftProblems(draft({ params: [], handler: { kind: 'script', code: '' } }), []).handler).toBeNull();
  });
});

describe('renameParam', () => {
  it('renames the parameter and moves the lookup with it', () => {
    const next = renameParam(draft(), 0, 'who');
    expect(next.params[0].name).toBe('who');
    expect(next.handler).toEqual({ kind: 'lookup', source: 'entities', param: 'who', returns: 'full' });
  });

  it('leaves the lookup on another parameter when two shared the old name', () => {
    const twins = draft({ params: [param(), param()] });
    expect(renameParam(twins, 0, 'who').handler).toMatchObject({ param: 'name' });
  });

  it('leaves the lookup alone when it searches by a different parameter', () => {
    const two = draft({ params: [param(), param({ name: 'place' })] });
    expect(renameParam(two, 1, 'where').handler).toMatchObject({ param: 'name' });
  });
});

describe('withHandlerKind', () => {
  it('starts a lookup on the first parameter', () => {
    const next = withHandlerKind(draft({ handler: { kind: 'script', code: 'return 1;' } }), 'lookup');
    expect(next.handler).toEqual({ kind: 'lookup', source: 'entities', param: 'name', returns: 'full' });
  });

  it('starts a blank Template or Script, and keeps the handler when the kind is unchanged', () => {
    expect(withHandlerKind(draft(), 'template').handler).toEqual({ kind: 'template', body: '' });
    expect(withHandlerKind(draft(), 'script').handler).toEqual({ kind: 'script', code: '' });
    const d = draft();
    expect(withHandlerKind(d, 'lookup')).toBe(d);
  });
});

describe('finishDraft', () => {
  it('trims each option and drops the blank ones', () => {
    const done = finishDraft(draft({ params: [param({ type: 'enum', options: [' calm', '', 'angry ', ' '] })] }));
    expect(done.params[0].options).toEqual(['calm', 'angry']);
  });

  it('clears the options of a parameter that is no longer a list', () => {
    expect(finishDraft(draft({ params: [param({ type: 'string', options: ['a'] })] })).params[0].options).toEqual([]);
  });
});

describe('tryItArguments', () => {
  const params = [
    param(), param({ name: 'count', type: 'number', required: false }),
    param({ name: 'loud', type: 'boolean', required: false }), param({ name: 'mood', type: 'enum', options: ['calm'], required: false }),
  ];

  it('sends each filled input as its parameter’s type', () => {
    expect(JSON.parse(tryItArguments(params, { name: 'Wren', count: '2', loud: 'true', mood: 'calm' })))
      .toEqual({ name: 'Wren', count: 2, loud: true, mood: 'calm' });
  });

  it('leaves out blank inputs, so the runner reports a missing required one', () => {
    expect(JSON.parse(tryItArguments(params, { name: '', count: '', loud: '' }))).toEqual({});
  });

  it('sends a number input that isn’t a number as text, as a model might', () => {
    expect(JSON.parse(tryItArguments(params, { count: 'two' }))).toEqual({ count: 'two' });
  });

  it('sends false for No', () => {
    expect(JSON.parse(tryItArguments(params, { loud: 'false' }))).toEqual({ loud: false });
  });
});
