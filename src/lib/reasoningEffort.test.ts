import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reasoningEffortValue, reasoningLevelOptions, promptReasoningLevelOptions, defaultPromptReasoning, defaultPromptReasoningSetting, resolvePromptReasoning, resolveRequestReasoning, reasoningOffRefused, resolveReasoningSetting, resolvePromptReasoningSetting, parseReasoningSetting, parsePromptReasoningSetting, parseReasoningCapability, reasoningCapabilityFromLevels, reasoningRuledOut, defaultReasoningBudgetPct, resolveReasoningBudgetPct, reasoningBudgetTokens, isReasoningEngaged, nativeReasoningSuppressed, MIN_REASONING_BUDGET_PCT, resolveReasoningCapability, UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability, type ReasoningEffortField, type PromptReasoning } from './reasoningEffort';
import { resetProbeMemo } from '@/lib/probeMemo';
import type { AIRequestType } from '@/types';

/** A record answering the levels question only, as a probe leaves it. */
const accepts = (...levels: ReasoningEffortField[]): ReasoningCapability => reasoningCapabilityFromLevels(levels, 'probe');

const ALL_KINDS: AIRequestType[] = [
  'thinking', 'director', 'character', 'storyboard', 'narration', 'choices', 'statUpdates', 'locationChange',
  'summary', 'milestoneSelect', 'diary', 'discoverEntity', 'timePassed', 'openingTime', 'sceneTags',
];

describe('reasoningEffortValue', () => {
  const all = accepts('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max');

  it('names the literal verbatim for every non-auto level the endpoint accepts', () => {
    expect(reasoningEffortValue('none', all)).toBe('none');
    expect(reasoningEffortValue('low', all)).toBe('low');
    expect(reasoningEffortValue('medium', all)).toBe('medium');
    expect(reasoningEffortValue('high', all)).toBe('high');
    expect(reasoningEffortValue('max', all)).toBe('max');
  });

  it('sends no literal for auto (send nothing → endpoint default)', () => {
    expect(reasoningEffortValue('auto', all)).toBeNull();
      });

  it('names no value the active endpoint does not accept (a stale selection cannot 400 a turn)', () => {
    // Ollama-like: accepts max, not minimal.
    const ollama = accepts('none', 'low', 'medium', 'high', 'max');
    expect(reasoningEffortValue('minimal', ollama)).toBeNull();
    expect(reasoningEffortValue('max', ollama)).toBe('max');
    expect(reasoningEffortValue('none', accepts('low', 'medium', 'high'))).toBeNull();
  });

  it('sends nothing until the levels question is answered — an unknown record omits the field', () => {
    expect(reasoningEffortValue('low', { reasons: null, levels: null, budget: null, dialect: 'unknown', offAllowed: null, sources: {} })).toBeNull();
    expect(reasoningEffortValue('low', null)).toBeNull();
    expect(reasoningEffortValue('low')).toBeNull();
  });

  it('sends nothing to a conclusively non-reasoning endpoint (empty levels), even none', () => {
    expect(reasoningEffortValue('none', accepts())).toBeNull();
    expect(reasoningEffortValue('high', accepts())).toBeNull();
  });

  it('sends nothing to a model the record says does not reason, whatever levels it lists', () => {
    const listedButNotReasoning: ReasoningCapability = {
      reasons: false, levels: ['none', 'low', 'high'], budget: null, dialect: 'unknown', offAllowed: null, sources: { reasons: 'native' },
    };
    expect(reasoningEffortValue('high', listedButNotReasoning)).toBeNull();
  });
});

describe('the capability record', () => {
  it('reads an empty levels answer as conclusive: the model does not reason, from that same source', () => {
    expect(reasoningCapabilityFromLevels([], 'probe')).toEqual({
      reasons: false, levels: [], budget: null, dialect: 'unknown', offAllowed: null, sources: { levels: 'probe', reasons: 'probe' },
    });
  });

  it('leaves the reasons question open when levels came back non-empty (accepting `none` proves nothing)', () => {
    expect(reasoningCapabilityFromLevels(['none', 'low'], 'probe')).toEqual({
      reasons: null, levels: ['none', 'low'], budget: null, dialect: 'unknown', offAllowed: null, sources: { levels: 'probe' },
    });
  });

  it('rules reasoning out on a negative reasons answer or an empty levels list, never on an unknown one', () => {
    expect(reasoningRuledOut({ reasons: false, levels: null, budget: null, dialect: 'unknown', offAllowed: null, sources: {} })).toBe(true);
    expect(reasoningRuledOut(accepts())).toBe(true);
    expect(reasoningRuledOut(accepts('none', 'low'))).toBe(false);
    expect(reasoningRuledOut({ reasons: null, levels: null, budget: null, dialect: 'unknown', offAllowed: null, sources: {} })).toBe(false);
    expect(reasoningRuledOut(null)).toBe(false);
  });

  it('loads a cache entry written as a bare effort list, so an update re-detects nothing', () => {
    expect(parseReasoningCapability(['none', 'low', 'high'])).toEqual({
      reasons: null, levels: ['none', 'low', 'high'], budget: null, dialect: 'unknown', offAllowed: null, sources: { levels: 'cache' },
    });
  });

  it('keeps a cached empty list hiding the controls, though its reasons answer is unknown', () => {
    const migrated = parseReasoningCapability([]);
    expect(migrated).toEqual({ reasons: null, levels: [], budget: null, dialect: 'unknown', offAllowed: null, sources: { levels: 'cache' } });
    expect(reasoningRuledOut(migrated)).toBe(true);
  });

  it('loads a stored record back verbatim', () => {
    const stored: ReasoningCapability = {
      reasons: true, levels: ['none', 'low'], budget: true, dialect: 'unknown', offAllowed: null,
      sources: { reasons: 'native', levels: 'probe', budget: 'engine' },
    };
    expect(parseReasoningCapability(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it('drops a stored source it does not know, rather than letting it stand as one', () => {
    const loaded = parseReasoningCapability({
      reasons: true, levels: null, budget: null, sources: { reasons: 'astrology', levels: 'probe', mood: 'probe' },
    });
    expect(loaded?.sources).toEqual({ levels: 'probe' });
  });

  it('rejects anything that is not a record or a list of known levels', () => {
    expect(parseReasoningCapability(['none', 'turbo'])).toBeNull();
    expect(parseReasoningCapability('high')).toBeNull();
    expect(parseReasoningCapability(null)).toBeNull();
    expect(parseReasoningCapability({ reasons: 'yes', levels: null, budget: null })).toBeNull();
    expect(parseReasoningCapability({ reasons: null, levels: ['turbo'], budget: null })).toBeNull();
  });
});

describe('nativeReasoningSuppressed', () => {
  it('suppresses only the narration call under Inline mode, which writes its own <think> block', () => {
    expect(nativeReasoningSuppressed('inline', 'narration')).toBe(true);
  });

  it('leaves every other kind under Inline, and every kind under the other modes, to its own choice', () => {
    for (const kind of ALL_KINDS.filter((k) => k !== 'narration')) expect(nativeReasoningSuppressed('inline', kind)).toBe(false);
    for (const mode of ['off', 'precall', 'staged'] as const) {
      for (const kind of ALL_KINDS) expect(nativeReasoningSuppressed(mode, kind)).toBe(false);
    }
  });
});

/**
 * Where the endpoint refuses a switched-off request, the switch renders checked and locked, so the request
 * must carry the strength that switch reads. Three shapes decide it: the record's own answer, the dialect
 * row's default where the record has none, and an ordinary record, which is left exactly as it is.
 */
describe('a request on an endpoint that refuses off', () => {
  const record = (over: Partial<ReasoningCapability>): ReasoningCapability => ({
    ...UNKNOWN_REASONING_CAPABILITY, reasons: true, levels: ['none', 'low', 'high'], ...over,
  });
  const off: Record<string, PromptReasoning> = { narration: 'none' };

  it('reads the record answer first, whichever way it points', () => {
    expect(reasoningOffRefused(record({ dialect: 'openrouter', offAllowed: false }))).toBe(true);
    expect(reasoningOffRefused(record({ dialect: 'openrouter', offAllowed: true }))).toBe(false);
    // A record answer of `false` overrides a dialect row that would otherwise allow off.
    expect(reasoningOffRefused(record({ dialect: 'lmstudio', offAllowed: false }))).toBe(true);
    // And an answer of `true` overrides a row that refuses it.
    expect(reasoningOffRefused(record({ dialect: 'moonshot-k3', offAllowed: true }))).toBe(false);
  });

  it('falls back to the dialect row where no source answered', () => {
    expect(reasoningOffRefused(record({ dialect: 'moonshot-k3' }))).toBe(true);
    expect(reasoningOffRefused(record({ dialect: 'openrouter' }))).toBe(false);
    expect(reasoningOffRefused(null)).toBe(false);
  });

  it('carries the prompt\'s kept strength where the record refuses off', () => {
    const refuses = record({ dialect: 'openrouter', offAllowed: false });
    const kept = { prompts: { narration: { enabled: false, level: 'high' as const } } };
    expect(resolveRequestReasoning('narration', off, 'low', 'off', refuses, kept)).toBe('high');
  });

  it('follows the endpoint-wide strength where the kept prompt strength is Global', () => {
    const refuses = record({ dialect: 'moonshot-k3' });
    const kept = {
      prompts: { narration: { enabled: false, level: 'global' as const } },
      global: { enabled: false, level: 'medium' as const },
    };
    // Both switches read as locked on, so both are ignored and the kept strengths stand.
    expect(resolveRequestReasoning('narration', off, 'none', 'off', refuses, kept)).toBe('medium');
  });

  it('falls back to the shipped strength when nothing is stored for the prompt', () => {
    const refuses = record({ dialect: 'moonshot-k3' });
    // Stat Updates ships switched off, remembering Global, and the shipped global strength is Model Default.
    expect(resolveRequestReasoning('statUpdates', {}, 'high', 'off', refuses)).toBe('auto');
  });

  it('leaves an ordinary record alone, switched off or on', () => {
    const ordinary = record({ dialect: 'openrouter', offAllowed: true });
    expect(resolveRequestReasoning('narration', off, 'low', 'off', ordinary)).toBe('none');
    expect(resolveRequestReasoning('narration', {}, 'low', 'off', ordinary)).toBe('low');
  });

  // Inline narration writes its own <think> block, so it stays off even where the endpoint refuses off; the
  // model reasons anyway there, and the app asks for nothing.
  it('keeps Inline narration switched off', () => {
    const refuses = record({ dialect: 'moonshot-k3' });
    const kept = { prompts: { narration: { enabled: true, level: 'high' as const } } };
    expect(resolveRequestReasoning('narration', {}, 'high', 'inline', refuses, kept)).toBe('none');
  });
});

describe('per-prompt reasoning', () => {
  it('ships tiered defaults: narration Global, planning and memory passes Low, parsers and choices None', () => {
    expect(defaultPromptReasoning('narration')).toBe('global');
    for (const kind of ['thinking', 'director', 'character', 'storyboard', 'summary', 'diary'] as const) {
      expect(defaultPromptReasoning(kind)).toBe('low');
    }
    for (const kind of ['choices', 'statUpdates', 'locationChange', 'milestoneSelect', 'discoverEntity', 'timePassed', 'openingTime', 'sceneTags'] as const) {
      expect(defaultPromptReasoning(kind)).toBe('none');
    }
  });

  it('ships the switch shape: narration on at Global, tiers on at Low, the rest off remembering Global', () => {
    expect(defaultPromptReasoningSetting('narration')).toEqual({ enabled: true, level: 'global' });
    expect(defaultPromptReasoningSetting('director')).toEqual({ enabled: true, level: 'low' });
    expect(defaultPromptReasoningSetting('choices')).toEqual({ enabled: false, level: 'global' });
  });

  it('lists a prompt\'s strengths as Global, Model Default, then the accepted levels in order, never none', () => {
    const opts = promptReasoningLevelOptions(accepts('high', 'none', 'low')); // out of order in
    expect(opts.map((o) => o.value)).toEqual(['global', 'auto', 'low', 'high']);
    expect(opts.map((o) => o.label)).toEqual(['Global', 'Model Default', 'Low', 'High']);
    expect(promptReasoningLevelOptions(null).map((o) => o.value)).toEqual(['global', 'auto', 'low', 'medium', 'high']); // safe fallback
  });

  it('keeps the current pick listed when the record no longer accepts it, so the dropdown never renders blank', () => {
    const onOff = accepts('none'); // LM Studio's on/off models: nothing graded
    expect(promptReasoningLevelOptions(onOff, 'low').map((o) => o.value)).toEqual(['global', 'auto', 'low']);
    expect(promptReasoningLevelOptions(onOff, 'global').map((o) => o.value)).toEqual(['global', 'auto']);
    expect(reasoningLevelOptions(onOff, 'high').map((o) => o.value)).toEqual(['auto', 'high']);
    expect(reasoningLevelOptions(onOff, 'auto').map((o) => o.value)).toEqual(['auto']);
  });

  it('lists the endpoint-wide strengths with full-word labels for backend-specific levels', () => {
    const cloud = reasoningLevelOptions(accepts('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'));
    expect(cloud.map((o) => o.label)).toEqual(['Model Default', 'Minimal', 'Low', 'Medium', 'High', 'Extra High', 'Max']);
    expect(cloud.map((o) => o.value)).not.toContain('none');
  });

  it('resolves Global to the endpoint-wide effort, explicit choices to themselves', () => {
    expect(resolvePromptReasoning('narration', {}, 'high', 'off')).toBe('high'); // default global → follows global
    expect(resolvePromptReasoning('narration', { narration: 'low' }, 'high', 'off')).toBe('low'); // override wins
    expect(resolvePromptReasoning('choices', {}, 'high', 'off')).toBe('none'); // default none, ignores global
    expect(resolvePromptReasoning('choices', { choices: 'global' }, 'medium', 'off')).toBe('medium');
  });

  it('honors a stored level on every kind, in every mode', () => {
    for (const mode of ['off', 'precall', 'staged', 'inline'] as const) {
      expect(resolvePromptReasoning('summary', { summary: 'high' }, 'low', mode)).toBe('high');
      expect(resolvePromptReasoning('statUpdates', { statUpdates: 'global' }, 'medium', mode)).toBe('medium');
      expect(resolvePromptReasoning('director', {}, 'high', mode)).toBe('low'); // shipped tier
    }
  });

  it('resolves Inline narration to none whatever is stored or set globally', () => {
    expect(resolvePromptReasoning('narration', { narration: 'high' }, 'high', 'inline')).toBe('none');
    expect(resolvePromptReasoning('narration', {}, 'max', 'inline')).toBe('none');
    expect(resolvePromptReasoning('narration', { narration: 'high' }, 'high', 'staged')).toBe('high');
  });
});

describe('reasoning budget (local engine)', () => {
  it('ships narration at 40% and every other prompt at 25%; the switch, not the %, decides off', () => {
    expect(defaultReasoningBudgetPct('narration')).toBe(40);
    for (const kind of ALL_KINDS.filter((k) => k !== 'narration')) expect(defaultReasoningBudgetPct(kind)).toBe(25);
  });

  it('resolves every kind to its stored/default %, clamped to the slider floor and 100', () => {
    expect(resolveReasoningBudgetPct('narration', {})).toBe(40);
    expect(resolveReasoningBudgetPct('narration', { narration: 20 })).toBe(20);
    expect(resolveReasoningBudgetPct('choices', { choices: 30 })).toBe(30);
    expect(resolveReasoningBudgetPct('summary', { summary: 90 })).toBe(90);
    expect(resolveReasoningBudgetPct('statUpdates', { statUpdates: 0 })).toBe(MIN_REASONING_BUDGET_PCT); // clamp low
    expect(resolveReasoningBudgetPct('narration', { narration: 250 })).toBe(100); // clamp high
  });

  it('converts the % to a token cap against max output for any resolved level', () => {
    expect(reasoningBudgetTokens('auto', 'narration', {}, 500)).toBe(200); // 40% of 500
    expect(reasoningBudgetTokens('high', 'narration', { narration: 20 }, 500)).toBe(100);
    expect(reasoningBudgetTokens('low', 'choices', { choices: 30 }, 400)).toBe(120);
    expect(reasoningBudgetTokens('low', 'director', {}, 400)).toBe(100); // 25% default
  });

  it('caps at 0 when the resolved choice is none, whatever % is stored', () => {
    expect(reasoningBudgetTokens('none', 'narration', { narration: 40 }, 500)).toBe(0);
    expect(reasoningBudgetTokens('none', 'choices', {}, 500)).toBe(0);
  });
});

describe('reasoning settings (switch + strength)', () => {
  it('resolves to the level while on and to none while off', () => {
    expect(resolveReasoningSetting({ enabled: true, level: 'high' })).toBe('high');
    expect(resolveReasoningSetting({ enabled: true, level: 'auto' })).toBe('auto');
    expect(resolveReasoningSetting({ enabled: false, level: 'high' })).toBe('none');
    expect(resolvePromptReasoningSetting({ enabled: true, level: 'global' })).toBe('global');
    expect(resolvePromptReasoningSetting({ enabled: false, level: 'global' })).toBe('none');
  });

  it('reads the current object and rejects a malformed one', () => {
    expect(parseReasoningSetting({ enabled: false, level: 'medium' })).toEqual({ enabled: false, level: 'medium' });
    expect(parseReasoningSetting({ enabled: 'yes', level: 'medium' })).toBeNull();
    expect(parseReasoningSetting({ enabled: true, level: 'none' })).toBeNull(); // none is the switch, not a level
    expect(parseReasoningSetting({ enabled: true, level: 'global' })).toBeNull(); // global is prompt-only
    expect(parsePromptReasoningSetting({ enabled: true, level: 'global' })).toEqual({ enabled: true, level: 'global' });
    expect(parsePromptReasoningSetting(42)).toBeNull();
  });

  it('folds the plain string written before the switch existed: none → off, a level → on at that level', () => {
    expect(parseReasoningSetting('none')).toEqual({ enabled: false, level: 'auto' });
    expect(parseReasoningSetting('auto')).toEqual({ enabled: true, level: 'auto' });
    expect(parseReasoningSetting('xhigh')).toEqual({ enabled: true, level: 'xhigh' });
    expect(parseReasoningSetting('bogus')).toBeNull();
    expect(parsePromptReasoningSetting('none')).toEqual({ enabled: false, level: 'global' });
    expect(parsePromptReasoningSetting('global')).toEqual({ enabled: true, level: 'global' });
    expect(parsePromptReasoningSetting('low')).toEqual({ enabled: true, level: 'low' });
  });
});

describe('isReasoningEngaged', () => {
  const everyKindOff = Object.fromEntries(ALL_KINDS.map((k) => [k, 'none'])) as Record<string, PromptReasoning>;

  it('is true out of the box: nothing stored, yet the shipped tiers switch several prompts on', () => {
    expect(isReasoningEngaged('off', 'auto', {})).toBe(true);
  });
  it('is false only when every prompt resolves to none', () => {
    expect(isReasoningEngaged('off', 'auto', everyKindOff)).toBe(false);
    // Narration at Global follows a switched-off endpoint-wide setting, so it counts as none too.
    expect(isReasoningEngaged('off', 'none', { ...everyKindOff, narration: 'global' })).toBe(false);
  });
  it('is true when a Thinking mode is active, whatever the prompts say', () => {
    expect(isReasoningEngaged('staged', 'none', everyKindOff)).toBe(true);
    expect(isReasoningEngaged('inline', 'none', everyKindOff)).toBe(true);
  });
  it('is true when one prompt follows a positive endpoint-wide level, or carries its own', () => {
    expect(isReasoningEngaged('off', 'high', { ...everyKindOff, narration: 'global' })).toBe(true);
    expect(isReasoningEngaged('off', 'none', { ...everyKindOff, summary: 'low' })).toBe(true);
    expect(isReasoningEngaged('off', 'none', { ...everyKindOff, summary: 'auto' })).toBe(true); // Model Default lets it reason
  });
});

describe('resolveReasoningCapability: the budget answer', () => {
  // Each source's own shape is covered in reasoningCapability.test.ts. These cases guard one contract:
  // which answers settle the budget question, since the request builder and the Options tab both read it.
  beforeEach(() => resetProbeMemo());

  const TARGET = { url: 'http://localhost:1234/v1/chat/completions', token: '', model: 'meromero' };
  const NATIVE_LIST = 'http://localhost:1234/api/v1/models';

  /** LM Studio answering its native list with one model, and 404ing every other advertisement path. */
  const lmStudio = (models: unknown[]) => vi.fn(async (u: string) => (
    u === NATIVE_LIST
      ? { ok: true, status: 200, json: async () => ({ models }), text: async () => '' }
      : { ok: false, status: 404, json: async () => ({}), text: async () => '' }
  ) as unknown as Response);

  it('takes a token budget when the native list calls the model reasoning', async () => {
    const record = await resolveReasoningCapability(TARGET, lmStudio([{ key: 'meromero', capabilities: { reasoning: {} } }]));
    expect(record?.budget).toBe(true);
    expect(record?.sources.budget).toBe('native');
  });

  it('never takes a budget on a model the native list calls non-reasoning', async () => {
    const record = await resolveReasoningCapability({ ...TARGET, model: 'cydonia' }, lmStudio([{ key: 'cydonia', capabilities: {} }]));
    expect(record?.budget).not.toBe(true);
  });

  it('answers every question from the native list when it calls the model non-reasoning, sending no probe', async () => {
    const doFetch = lmStudio([{ key: 'cydonia', capabilities: {} }]);
    expect(await resolveReasoningCapability({ ...TARGET, model: 'cydonia' }, doFetch)).toEqual({
      reasons: false, levels: [], budget: null, dialect: 'lmstudio', offAllowed: null,
      sources: { reasons: 'native', levels: 'native', dialect: 'native' },
    });
    // Only the capability GET fired — no POST probe reached the completions URL.
    expect(doFetch.mock.calls.filter(([u]) => u === TARGET.url)).toHaveLength(0);
  });

  it('leaves the budget question unanswered when only the probe spoke', async () => {
    const doFetch = vi.fn(async (u: string) => (
      u === TARGET.url
        ? { ok: true, status: 200, json: async () => ({}), text: async () => '' }
        : { ok: false, status: 404, json: async () => ({}), text: async () => '' }
    ) as unknown as Response);
    expect((await resolveReasoningCapability({ ...TARGET, model: 'plain' }, doFetch))?.budget).toBeNull();
  });
});
