// Run with vite-node: --capture <requests.json>, then --requests <requests.json> --output <results.json>.
// Uses the committed Sedge Landing cases and production style/context/rendering boundaries.
import { readFile, writeFile } from 'node:fs/promises';
import { PROMPT_TEXT_DEFAULTS } from '@/components/game/GamePrompts';
import { buildStyledValues } from '@/lib/sectionStyle';
import { ALL_PROMPT_VARIABLES, variableVariantIds, withVariant } from '@/lib/promptVariables';
import { expandScopedTokens, buildLocationContext, renderEntityRoster } from '@/lib/locationContext';
import { buildTraitContext } from '@/lib/traitTree';
import { personaContextValues } from '@/lib/personaContext';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { parseDirectorCast } from '@/lib/stagedPlanning';
import { TURN_PASSES } from '@/lib/turnPipeline/turnPasses';
import { emptyTurnMaterial } from '@/lib/turnPipeline/turnPlan';
import { testInput, TEST_PROMPTS } from '@/lib/turnPipeline/turnTestInputs';
import { runsTile } from '@/lib/requestAnatomy';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const capture = option('--capture');
if (capture) {
  const templates = option('--templates') ? JSON.parse(await readFile(option('--templates'), 'utf8')) : null;
  const corpus = JSON.parse(await readFile(new URL('../planning-cases.json', import.meta.url), 'utf8'));
  const requests = [];
  for (const kind of ['narration', 'thinking', 'choices']) {
    for (const [index, name] of ['carry-forward-all', 'drop-who-leaves'].entries()) {
      const scene = corpus.cases.find(c => c.name === name);
      const style = index ? 'xml' : kind === 'choices' ? 'labels' : 'markdown';
      const prompts = templates?.[style] ?? buildStyledValues(PROMPT_TEXT_DEFAULTS, style);
      const empty = Object.fromEntries(ALL_PROMPT_VARIABLES.flatMap(v =>
        [null, ...variableVariantIds(v)].map(id => [withVariant(v.token, id), 'N/A'])));
      const entities = scene.entities.map((e, i) => ({ id: String(i), name: e.name, aiDescription: e.description, type: e.type }));
      const location = { id: 'landing', name: 'The Ferry Landing', aiDescription: corpus.location, entities: entities.map(e => e.id) };
      const ctx = {
        ...empty,
        ...expandScopedTokens('<LOCATION>', { '': opts => buildLocationContext(location, opts) }),
        ...expandScopedTokens('<ENTITIES>', { '': opts => renderEntityRoster(location.entities, entities, opts) }),
        ...personaContextValues(null),
        '<WORLD DESCRIPTION>': corpus.world, '<NOTES>': '', '<LANGUAGE>': '',
        '<PLAYER ACTION>': scene.action, '<NARRATION>': scene.prevNarration,
      };
      for (const format of ['simple', 'markdown', 'xml']) {
        ctx[format === 'simple' ? '<TRAITS DESCRIPTION>' : `<TRAITS DESCRIPTION|${format}>`] =
          buildTraitContext(['identity'], [{ id: 'identity', name: 'Identity', aiDescription: corpus.playerTrait }], [], format);
      }
      const input = testInput({ action: scene.action, prompts: { ...TEST_PROMPTS,
        thinking: prompts.thinkingPrompt, choices: prompts.choicesPrompt, choicesUser: prompts.choicesUserPrompt,
        narrationUser: prompts.narrationUserPrompt, oocDirective: prompts.oocDirectivePrompt } },
        { thinkingMode: kind === 'thinking' ? 'precall' : 'off' });
      const material = { ...emptyTurnMaterial({ action: scene.action, effectiveAction: scene.action, turnId: 'probe', baseCtx: ctx, destinations: [] }),
        ctx, lastStory: scene.prevNarration, narration: scene.prevNarration };
      if (kind === 'narration') {
        const { prompt, runs } = buildNarrationPrompt({ template: prompts.systemPrompt, ctx, action: scene.action,
          history: [], dictionary: [], actionVec: null, semanticLore: false, embedVectors: new Map(),
          language: 'English', paragraphLimit: 2, maxTokens: 400, markdownOutput: true, sectionStyle: style, resolvePH: text => text });
        material.narrationSystemPrompt = prompt;
        material.narrationSystemPromptRuns = runs;
        material.trimmedHistory = [{ role: 'assistant', content: scene.prevNarration }];
        material.historyRuns = [[{ start: 0, end: scene.prevNarration.length, contextLabel: 'past-narration' }]];
      }
      const request = TURN_PASSES.find(pass => pass.id === kind).buildRequest(input, material);
      if (!runsTile(request.systemPrompt, request.anatomy.system) || request.messages.some((message, i) => !runsTile(message.content, request.anatomy.messages[i]))) throw new Error('Request anatomy does not tile');
      const messages = [{ role: 'system', content: request.systemPrompt }, ...request.messages];
      if (messages.some(m => /<(?:PERSONA|WORLD DESCRIPTION|NOTES|NARRATION)(?:[>|])/.test(m.content))) throw new Error('Unresolved chip');
      requests.push({ name: `${kind}-${name}-${style}`, kind, style, maxTokens: request.maxTokens ?? 400, castPresent: scene.castPresent, castAbsent: scene.castAbsent, messages });
    }
  }
  await writeFile(capture, JSON.stringify(requests, null, 2));
  console.log(`Captured ${requests.length} production-rendered requests in ${capture}`);
} else {
  const requests = JSON.parse(await readFile(option('--requests'), 'utf8'));
  const comparison = option('--compare') ? JSON.parse(await readFile(option('--compare'), 'utf8')) : null;
  const output = option('--output');
  const endpoint = option('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
  const model = option('--model', 'default');
  const runs = Number(option('--runs', model === 'default' ? '12' : '2'));
  const results = [];
  const started = performance.now();
  for (const request of requests) {
    for (let run = 0; run < runs; run++) {
      for (const [arm, current] of comparison ? [['before', request], ['after', comparison.find(candidate => candidate.name === request.name)]] : [['single', request]]) {
        if (!current) throw new Error(`Missing comparison: ${request.name}`);
        const pins = PROMPT_SAMPLER_PINS[request.kind] ?? {};
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(180000), body: JSON.stringify({ model, messages: current.messages,
            max_tokens: current.maxTokens, seed: 1701 + run, reasoning_effort: 'none', stream: false,
            ...(pins.temperature !== undefined ? { temperature: pins.temperature } : {}),
            ...(pins.repetitionPenalty !== undefined ? { repetition_penalty: pins.repetitionPenalty } : {}),
          }) });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
        const result = await response.json();
        const text = result.choices?.[0]?.message?.content ?? '';
        const lines = text.trim().split('\n').filter(line => line.trim());
        const cast = request.kind === 'thinking' ? parseDirectorCast(text).cast : [];
        const names = cast.map(member => member.name).join(' ').toLowerCase();
        const metrics = {
          nonempty: Number(!!text.trim()), cut: Number(result.choices?.[0]?.finish_reason === 'length'),
          words: text.trim().split(/\s+/).length, dialogue: Number(/["“][^"”\n]{3,}["”]/.test(text)),
          bold: Number(/\*\*/.test(text)),
          ...(request.kind === 'choices' ? { choicesContract: Number(lines.length >= 3 && lines.length <= 5 && lines.every(line => /^I\s/.test(line.trim()) && line.trim().split(/\s+/).length <= 25)) } : {}),
          ...(request.kind === 'thinking' ? { castCorrect: Number(request.castPresent.every(name => names.includes(name.toLowerCase())) && request.castAbsent.every(name => !names.includes(name.toLowerCase()))), beats: Number(/\bBeats\s*:/i.test(text)) } : {}),
          ...(request.kind === 'narration' ? { menuLeak: Number(/(?:^|\n)\s*(?:\d+[.)]|[-*]\s+I\s|(?:Choices|Options):)/i.test(text)) } : {}),
        };
        results.push({ name: request.name, arm, run, seed: 1701 + run, text, metrics });
        await writeFile(output, JSON.stringify({ model, endpoint, elapsedSeconds: (performance.now() - started) / 1000, results }, null, 2));
        console.log(`${arm} ${request.name} ${run + 1}/${runs} ${JSON.stringify(metrics)}`);
        }
      }
    }
    console.log(`WALL_SECONDS=${(performance.now() - started) / 1000}`);
  }
