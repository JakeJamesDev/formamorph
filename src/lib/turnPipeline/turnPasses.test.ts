import { describe, it, expect } from 'vitest';
import { TURN_PASSES, TURN_PASS_CAPS } from './turnPasses';
import { planTurn } from './planTurn';
import type { Entity } from '@/types';
import type { TurnMaterial, TurnPassId, TurnPassRecord, TurnPlanInput, TurnSettings } from './turnPlan';
import { TEST_PROMPTS, testInput } from './turnTestInputs';
import { INLINE_THINKING_DIRECTIVE, OPENING_SCENE_CUE, planDirective } from '@/components/game/GamePrompts';

// Each pass assembles its own request. These tests call the records directly, with templates whose tokens
// are recognizable, so a token rendered from the wrong context (or a cap that drifts) is visible.

const input = testInput;

const BRAM: Entity = { id: 'e1', name: 'Bram', aiSummary: 'The one-armed ferryman.' } as Entity;

const material = (over: Partial<TurnMaterial> = {}): TurnMaterial => ({
  action: 'I read the notices.',
  effectiveAction: 'I read the notices.',
  turnId: 'turn-1',
  // The two context scopes carry different markers, so a pass reading the wrong one is visible.
  ctx: { '<WORLD DESCRIPTION>': 'TURN-LOCATION', '<ENTITIES>': 'ALL ENTITIES' },
  baseCtx: { '<WORLD DESCRIPTION>': 'CURRENT-LOCATION', '<ENTITIES>': 'ALL ENTITIES' },
  sceneEntityTokens: { '<ENTITIES>': 'IN SCENE ONLY' },
  destinations: ['The Far Bank', 'The Sedge Road'],
  narrationSystemPrompt: 'ASSEMBLED NARRATION PROMPT',
  trimmedHistory: [
    { role: 'user', content: 'START GAME' },
    { role: 'assistant', content: 'The dock is damp.' },
  ],
  narration: 'The notices are damp and half-illegible.',
  lastStory: 'The dock is damp.',
  plannerRecap: '',
  turnPlan: '',
  activeCharacterGuidance: 'GUIDANCE',
  directorScene: 'Dusk on the dock.',
  npcCastSize: 2,
  intents: [{ name: 'Bram', text: 'I wait.' }],
  overflow: ['Odette'],
  ...over,
});

const pass = (id: TurnPassId): TurnPassRecord => {
  const record = TURN_PASSES.find((p) => p.id === id);
  if (!record) throw new Error(`no pass record for ${id}`);
  return record;
};

const build = (id: TurnPassId, over: Partial<TurnMaterial> = {}, planOver: Partial<TurnPlanInput> = {}, settings: Partial<TurnSettings> = {}) =>
  pass(id).buildRequest(input(planOver, settings), material(over));

const lastMessage = (id: TurnPassId, over: Partial<TurnMaterial> = {}, planOver: Partial<TurnPlanInput> = {}, settings: Partial<TurnSettings> = {}) => {
  const messages = build(id, over, planOver, settings).messages;
  return messages[messages.length - 1].content;
};

describe('turn pass requests', () => {
  describe('the location router', () => {
    it('resolves the move from the pre-move context and the action alone', () => {
      const request = build('locationAuto');
      // Rendered before the move, so it reads the location the turn began in.
      expect(request.systemPrompt).toBe('ROUTER CURRENT-LOCATION');
      expect(request.messages).toEqual([{ role: 'user', content: 'Action: I read the notices.' }]);
      expect(request.maxTokens).toBeNull();
      expect(request.silent).toBe(false);
    });

    it('suggests from the turn context and the narration it just read', () => {
      const request = build('locationSuggest');
      expect(request.systemPrompt).toBe('ROUTER TURN-LOCATION');
      expect(request.messages[0].content).toBe('Action: I read the notices.');
    });

    it('matches the reply against the turn’s navigable destinations', () => {
      expect(pass('locationAuto').parseResponse('The Far Bank', material())).toBe('The Far Bank');
      expect(pass('locationAuto').parseResponse('NONE', material())).toBeNull();
      expect(pass('locationAuto').parseResponse('Atlantis', material())).toBeNull();
    });
  });

  describe('the narration', () => {
    it('takes the assembled system prompt and appends its user turn to the trimmed history', () => {
      const request = build('narration', {}, {}, { thinkingMode: 'off' });
      expect(request.systemPrompt).toBe('ASSEMBLED NARRATION PROMPT');
      expect(request.messages.slice(0, 2)).toEqual(material().trimmedHistory);
      expect(request.messages).toHaveLength(3);
      expect(request.maxTokens).toBeNull();
    });

    it('applies the user template only with thinking off', () => {
      expect(lastMessage('narration', {}, {}, { thinkingMode: 'off' })).toBe('Player: I read the notices.');
      for (const mode of ['precall', 'inline', 'staged'] as const) {
        expect(lastMessage('narration', {}, {}, { thinkingMode: mode })).toContain('I read the notices.');
        expect(lastMessage('narration', {}, {}, { thinkingMode: mode })).not.toContain('Player: ');
      }
    });

    it('rides the OOC rider on bracket turns only, and only with thinking off', () => {
      const bracket = { action: 'I wait. [make her leave]', effectiveAction: 'I wait. [make her leave]' };
      expect(lastMessage('narration', bracket, {}, { thinkingMode: 'off' })).toBe('Player: I wait. [make her leave]\n\nOOC RIDER');
      expect(lastMessage('narration', {}, {}, { thinkingMode: 'off' })).not.toContain('OOC RIDER');
      expect(lastMessage('narration', bracket, {}, { thinkingMode: 'staged' })).not.toContain('OOC RIDER');
      // An empty rider prompt adds nothing, even on a bracket turn.
      expect(
        lastMessage('narration', bracket, { prompts: { ...TEST_PROMPTS, oocDirective: '  ' } }, { thinkingMode: 'off' }),
      ).toBe('Player: I wait. [make her leave]');
    });

    it('rides the inline think directive in inline mode only', () => {
      expect(lastMessage('narration', {}, {}, { thinkingMode: 'inline' })).toBe(
        `I read the notices.${INLINE_THINKING_DIRECTIVE}`,
      );
      expect(lastMessage('narration', {}, {}, { thinkingMode: 'off' })).not.toContain(INLINE_THINKING_DIRECTIVE);
    });

    it('attaches the turn plan as stage directions, after the action', () => {
      const withPlan = lastMessage('narration', { turnPlan: 'Scene: dusk.' }, {}, { thinkingMode: 'staged' });
      expect(withPlan).toBe(`I read the notices.${planDirective('Scene: dusk.')}`);
      expect(lastMessage('narration', {}, {}, { thinkingMode: 'staged' })).not.toContain('Rough notes');
    });

    it('sends the opening cue verbatim, and maps the legacy sentinel to the default cue', () => {
      const opening = { isGameStarted: false };
      expect(lastMessage('narration', { action: 'Begin at the dock.' }, opening, { thinkingMode: 'off' })).toBe(
        'Player: Begin at the dock.',
      );
      expect(lastMessage('narration', { action: 'START GAME' }, opening, { thinkingMode: 'off' })).toBe(
        `Player: ${OPENING_SCENE_CUE}`,
      );
    });
  });

  describe('the planning stages', () => {
    it('renders the director against the turn context plus the active-character guidance', () => {
      const request = build('director');
      expect(request.systemPrompt).toBe('DIRECTOR TURN-LOCATION GUIDANCE');
      expect(request.messages[0].content).toBe('Last: The dock is damp. | Now: I read the notices.');
      expect(request.maxTokens).toBe(TURN_PASS_CAPS.director);
    });

    it('gives the director a placeholder when there is no story yet', () => {
      expect(build('director', { lastStory: '' }).messages[0].content).toBe('Last: N/A | Now: I read the notices.');
    });

    it('names the character it is asking for in that pass’s system prompt', () => {
      const request = build('character', { subject: { name: 'Bram', stance: 'at the stern', entity: BRAM } });
      expect(request.systemPrompt).toBe('CHARACTER TURN-LOCATION as Bram');
      expect(request.messages[0].content).toContain('You are Bram.');
      expect(request.messages[0].content).toContain('The one-armed ferryman.');
      expect(request.messages[0].content).toContain('Where I am now: at the stern');
      expect(request.maxTokens).toBe(TURN_PASS_CAPS.character);
    });

    it('refuses to build a fan-out request with no subject', () => {
      expect(() => build('character')).toThrow(/subject/);
      expect(() => build('diary')).toThrow(/subject/);
      expect(() => build('discoverEntity')).toThrow(/subject/);
    });

    it('hands the storyboarder the scene, the intents and the overflow', () => {
      const content = build('storyboard').messages[0].content;
      expect(content).toContain('Scene: Dusk on the dock.');
      expect(content).toContain('- Bram: I wait.');
      expect(content).toContain('Also present: Odette');
      expect(build('storyboard').maxTokens).toBe(TURN_PASS_CAPS.storyboard);
    });

    it('leads the precall planner with its banded recap when there is one', () => {
      expect(lastMessage('thinking', { plannerRecap: 'EARLIER: a long walk.' })).toMatch(
        /^EARLIER: a long walk\.\n\nWhat just happened:\nThe dock is damp\./,
      );
      expect(lastMessage('thinking')).toMatch(/^What just happened:/);
      expect(build('thinking').maxTokens).toBe(TURN_PASS_CAPS.thinking);
    });
  });

  describe('the post-narration passes', () => {
    it('shows the choices writer only who is in the scene', () => {
      // The scene override must beat the location roster, or choices can act for someone who is not here.
      expect(build('choices').systemPrompt).toBe('CHOICES TURN-LOCATION IN SCENE ONLY');
      expect(build('choices').messages[0].content).toBe('Choices: I read the notices. | The notices are damp and half-illegible.');
    });

    it('appends the language directive to the choices and stat prompts when the game is not in English', () => {
      expect(build('choices', {}, {}, { language: 'French' }).systemPrompt).toContain('\nWrite all choices in French.');
      expect(build('statUpdates', {}, {}, { language: 'French' }).systemPrompt).toContain('\n Please write in english');
      expect(build('choices').systemPrompt).not.toContain('Write all choices in');
      expect(build('statUpdates').systemPrompt).not.toContain('Please write in english');
    });

    it('counts blank, whitespace and any casing of English as English in both passes', () => {
      for (const language of ['', '   ', 'english', 'ENGLISH', ' English ']) {
        expect(build('choices', {}, {}, { language }).systemPrompt).not.toContain('Write all choices in');
        expect(build('statUpdates', {}, {}, { language }).systemPrompt).not.toContain('Please write in english');
      }
    });

    it('reads a padded value as the bare language name', () => {
      expect(build('choices', {}, {}, { language: ' French ' }).systemPrompt)
        .toContain('\n\nWrite all choices in French.');
    });

    it('digests and diarizes from the context the turn began in', () => {
      // The digest and diary passes read the unscoped context, not the moved-to location's.
      expect(build('summary').systemPrompt).toBe('SUMMARY CURRENT-LOCATION');
      expect(build('diary', { subject: { name: 'Bram', entity: BRAM } }).systemPrompt).toBe('DIARY CURRENT-LOCATION');
      expect(build('statUpdates').systemPrompt).toBe('STATS TURN-LOCATION');
    });

    it('keeps authorial directions out of the digest and the clock', () => {
      const ooc = { effectiveAction: 'I wait. [make her leave]' };
      expect(build('summary', ooc).messages[0].content).toContain('Digest: I wait. |');
      expect(build('timePassed', ooc).messages[0].content).toContain('Time: I wait. |');
      // Choices and stats read the action as the player wrote it.
      expect(build('choices', ooc).messages[0].content).toContain('[make her leave]');
    });

    it('marks the turn-owned silent passes and attaches them to this turn', () => {
      for (const id of ['summary', 'timePassed', 'openingTime'] as const) {
        const request = build(id);
        expect([id, request.silent, request.attachTurnId]).toEqual([id, true, 'turn-1']);
      }
      const diary = build('diary', { subject: { name: 'Bram', entity: BRAM } });
      expect([diary.silent, diary.attachTurnId]).toEqual([true, 'turn-1']);
      // The player waits on these, so they are never silent.
      for (const id of ['narration', 'choices', 'statUpdates', 'director'] as const) {
        expect(build(id, { subject: { name: 'Bram' } }).silent).toBe(false);
      }
    });

    it('quiets the batched passes so they do not race over one status label', () => {
      // Dispatched together, choices/stats/location run quiet and the batch shows one label; dispatched
      // one at a time, each names itself.
      for (const id of ['choices', 'statUpdates'] as const) {
        expect([id, build(id).quiet]).toEqual([id, true]);
        expect([id, build(id, {}, {}, { concurrentTurnRequests: false }).quiet]).toEqual([id, false]);
      }
      expect(build('locationSuggest', {}, {}, { locationAutoApply: false }).quiet).toBe(true);
      // The narration and the planning stages always own the label; the up-front router runs before any batch.
      for (const id of ['narration', 'director', 'storyboard', 'locationAuto'] as const) {
        expect([id, build(id).quiet]).toEqual([id, false]);
      }
    });

    it('sends the discovery prompt as authored and pins the caps the passes ask for', () => {
      const discover = build('discoverEntity', { subject: { name: 'Ferryman' } });
      expect(discover.systemPrompt).toBe('DISCOVER PROMPT');
      expect(discover.messages[0].content).toBe(
        'Character name: Ferryman\n\nThe passage they appeared in:\nThe notices are damp and half-illegible.',
      );
      expect(discover.maxTokens).toBe(TURN_PASS_CAPS.discoverEntity);
      expect(build('summary').maxTokens).toBe(TURN_PASS_CAPS.summary);
      expect(build('timePassed').maxTokens).toBe(TURN_PASS_CAPS.timePassed);
      expect(build('openingTime', {}, { isGameStarted: false }).maxTokens).toBe(TURN_PASS_CAPS.openingTime);
      expect(build('diary', { subject: { name: 'Bram' } }).maxTokens).toBe(TURN_PASS_CAPS.diary);
    });
  });

  describe('parsing', () => {
    it('reads each pass’s answer into the value the turn commits', () => {
      expect(pass('choices').parseResponse('Wait\nLeave', material())).toEqual(['Wait', 'Leave']);
      expect(pass('statUpdates').parseResponse('Health: -5', material())).toEqual({ values: { health: -5 }, maxes: {} });
      expect(pass('timePassed').parseResponse('2h', material())).toBe(2);
      expect(pass('summary').parseResponse('  a digest  ', material())).toBe('a digest');
      expect(pass('diary').parseResponse('  I waited.  ', material())).toBe('I waited.');
      expect(pass('director').parseResponse('Scene: dusk\nCast:\n- Bram', material())).toEqual({
        scene: 'dusk',
        cast: [{ name: 'Bram', stance: undefined }],
      });
    });

    it('never lets an unreadable clock reply pass as a measurement', () => {
      expect(pass('timePassed').parseResponse('who knows', material())).toBeNull();
      expect(pass('openingTime').parseResponse('somewhen', material())).toBeNull();
    });

    it('skips the storyboard when the director cast nobody — there is nothing to reconcile', () => {
      expect(pass('storyboard').isReady?.(material({ npcCastSize: 0 }))).toBe(false);
      expect(pass('storyboard').isReady?.(material())).toBe(true);
      // Every other pass is ready the moment it is due.
      for (const record of TURN_PASSES) {
        if (record.id !== 'storyboard') expect([record.id, record.isReady]).toEqual([record.id, undefined]);
      }
    });

    it('hands the free-text passes through untouched — the turn reads them whole', () => {
      for (const id of ['narration', 'character', 'storyboard'] as const) {
        expect(pass(id).parseResponse('  raw text  ', material())).toBe('  raw text  ');
      }
      expect(pass('locationSuggest').parseResponse('The Sedge Road', material())).toBe('The Sedge Road');
      expect(pass('thinking').parseResponse('Cast:\n- Bram', material())).toEqual({
        scene: '',
        cast: [{ name: 'Bram', stance: undefined }],
      });
    });

    it('strips the discovery labels back off the description', () => {
      const cleaned = pass('discoverEntity').parseResponse(
        'Character name: Ferryman\nA weathered man of few words.',
        material({ subject: { name: 'Ferryman' } }),
      );
      expect(cleaned).toBe('A weathered man of few words.');
    });
  });

  it('gives every planned pass a record with both ends', () => {
    const plan = planTurn(input());
    for (const record of plan.passes) {
      expect(typeof record.buildRequest).toBe('function');
      expect(typeof record.parseResponse).toBe('function');
      expect(record.type.length).toBeGreaterThan(0);
    }
  });
});
