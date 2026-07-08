// Real-parser fidelity probe for the precall planning pipeline. Unlike planning-probe.mjs (which mirrors
// the parser to grade plan QUALITY), this feeds real 12B/24B plan output through the APP'S ACTUAL
// parseDirectorCast -> classifyCast -> sanitizePlanForReveal and grades whether the wiring holds up:
// does the cast parse cleanly, do present defined entities classify as directorCandidates (the alias form
// is a known risk), does a mentioned-but-absent / reachable character stay OUT of the cast, and does the
// sanitizer actually strip a not-yet-revealed real name from what the narrator would read.
//
// Opt-in (needs LM Studio up + profiles.json): PARSER_PROBE=1 npx vitest run testing/baseline/harness/planning-parser-probe.test.ts
// Flags via env: PROBE_MODEL (label substring, default rocinante) · PROBE_TEMP (default 0.4) · PROBE_RUNS (default 1)

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDirectorCast, classifyCast, sanitizePlanForReveal } from '@/lib/stagedPlanning';
import { matchNames } from '@/lib/entityMatch';
import { defaultThinkingPrompt } from '@/components/game/GamePrompts';
import type { Entity } from '@/types';

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROFILES = path.join(HARNESS_DIR, 'profiles.json');
const CASES = path.resolve(HARNESS_DIR, '../planning-cases.json');

const RUN = process.env.PARSER_PROBE === '1' && existsSync(PROFILES);

interface ProbeEntity { name: string; description: string; type: string }
interface ProbeCase {
  name: string;
  entities: ProbeEntity[];
  reachableEntities?: ProbeEntity[];
  prevNarration: string;
  action: string;
  castPresent?: string[];
  castAbsent?: string[];
  mentionedAbsent?: string[];
  expectDirector?: string[];
  expectAdHoc?: string[];
  revealed?: string[];
  soloExpected?: boolean;
}

const asEntity = (e: ProbeEntity): Entity => ({ id: e.name, name: e.name });
const has = (names: string[], sub: string) => names.some((n) => n.toLowerCase().includes(sub.toLowerCase()));
// Whole-word, case-insensitive presence of `name` in `text` (what the narrator would actually see).
const nameInText = (text: string, name: string) =>
  new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);

describe.skipIf(!RUN)('planning parser fidelity (real pipeline vs live model)', () => {
  const cfg = JSON.parse(readFileSync(PROFILES, 'utf8'));
  const data = JSON.parse(readFileSync(CASES, 'utf8'));
  const { world, playerName, playerTrait, location, cases } = data as {
    world: string; playerName: string; playerTrait: string; location: string; cases: ProbeCase[];
  };

  const modelFilter = process.env.PROBE_MODEL ?? 'rocinante';
  const temp = Number(process.env.PROBE_TEMP ?? 0.4);
  const runs = Number(process.env.PROBE_RUNS ?? 1);
  const model = cfg.models.find((m: { label: string }) => m.label.includes(modelFilter)) ?? cfg.models[0];

  const renderEntities = (entities: ProbeEntity[]) =>
    entities.length
      ? entities.map((e) => `- **${e.name}**\n  - **description:** ${e.description}\n  - **type:** ${e.type}`).join('\n')
      : 'N/A';
  const renderSys = (c: ProbeCase) =>
    defaultThinkingPrompt
      .replaceAll('<WORLD DESCRIPTION>', world)
      .replaceAll('<TRAITS DESCRIPTION|markdown>', `- **Identity:** ${playerTrait}`)
      .replaceAll('<LOCATION|summary.markdown>', `- **name:** ${location}`)
      .replaceAll('<LOCATION|sublocations.summary.markdown>', 'N/A')
      .replaceAll('<LOCATION|reachable.summary.markdown>', 'N/A')
      .replaceAll('<ENTITIES|summary.markdown>', renderEntities(c.entities))
      .replaceAll('<ENTITIES|sublocations.summary.markdown>', 'N/A')
      .replaceAll('<ENTITIES|reachable.summary.markdown>', renderEntities(c.reachableEntities ?? []))
      .replaceAll('<NOTES>', 'None');
  const renderUser = (c: ProbeCase) =>
    `What just happened:\n${c.prevNarration}\n\nThe player's next action: ${c.action}\n\nSet the scene, list the cast, and lay out the beats now. Do not narrate.`;

  async function call(sys: string, user: string): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiToken) headers.Authorization = `Bearer ${cfg.apiToken}`;
    const res = await fetch(cfg.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model.modelName,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        max_tokens: 256, temperature: temp, stream: false,
      }),
    });
    const j = await res.json();
    return (j.choices?.[0]?.message?.content ?? '').trim();
  }

  it('runs the real parse/classify/sanitize over live plans and reports fidelity', async () => {
    const agg = { pass: 0, total: 0, pollute: 0, presentMiss: 0, absentLeak: 0, dirMiss: 0, adhocMiss: 0, sanitizeLeak: 0, revealClobber: 0, solo: 0 };
    console.log(`\nParser-fidelity probe · ${model.label} · temp ${temp} · ${runs} run(s)/case\n`);
    await call(renderSys(cases[0]), 'warm up').catch(() => {});

    for (const c of cases) {
      const pool = [...c.entities, ...(c.reachableEntities ?? [])].map(asEntity);
      for (let r = 0; r < runs; r++) {
        const raw = await call(renderSys(c), renderUser(c));
        const { cast } = parseDirectorCast(raw);
        const { npcCast, directorCandidates, adHocCandidates } = classifyCast(cast, pool, [playerName]);
        const npcNames = npcCast.map((m) => m.name);
        const revealed = c.revealed ?? [];
        const isRevealed = (n: string) => matchNames(c.prevNarration, [n]).length > 0;
        const sanitized = sanitizePlanForReveal(raw, isRevealed);

        const fails: string[] = [];
        // Parser: did any cast name come out polluted by the "Name (alias)" form?
        if (npcNames.some((n) => n.includes('('))) { fails.push(`POLLUTE:${npcNames.filter((n) => n.includes('(')).join('/')}`); agg.pollute++; }
        // Presence: everyone physically here is cast; nobody merely-mentioned/elsewhere is.
        for (const n of c.castPresent ?? []) if (!has(npcNames, n)) { fails.push(`PRESENT-MISS:${n}`); agg.presentMiss++; }
        for (const n of [...(c.castAbsent ?? []), ...(c.mentionedAbsent ?? [])]) if (has(npcNames, n)) { fails.push(`ABSENT-LEAK:${n}`); agg.absentLeak++; }
        // Classification: present defined entities -> director bucket; invented -> ad-hoc bucket.
        for (const n of c.expectDirector ?? []) if (!has(directorCandidates, n)) { fails.push(`DIR-MISS:${n}`); agg.dirMiss++; }
        for (const n of c.expectAdHoc ?? []) if (!has(adHocCandidates, n)) { fails.push(`ADHOC-MISS:${n}`); agg.adhocMiss++; }
        if (c.soloExpected && npcCast.length) { fails.push(`INVENTED:${npcNames.join('/')}`); agg.solo++; }
        // Sanitize: an unrevealed present name must be gone from what the narrator reads; a revealed one stays.
        for (const n of c.expectDirector ?? []) {
          if (!revealed.some((rv) => rv.toLowerCase() === n.toLowerCase())) {
            if (nameInText(sanitized, n)) { fails.push(`SANITIZE-LEAK:${n}`); agg.sanitizeLeak++; }
          } else if (has(npcNames, n) && !nameInText(sanitized, n)) { fails.push(`REVEAL-CLOBBER:${n}`); agg.revealClobber++; }
        }

        const ok = fails.length === 0;
        agg.total++; if (ok) agg.pass++;
        const castStr = cast.map((m) => (m.isPlayer ? '[P]' : m.name)).join(', ') || '(none)';
        console.log(`[${ok ? 'PASS' : 'FAIL'}] ${c.name}${runs > 1 ? ` #${r + 1}` : ''}${fails.length ? '  <' + fails.join(',') + '>' : ''}`);
        console.log(`        cast: ${castStr}  | dir: [${directorCandidates.join(', ')}]  adhoc: [${adHocCandidates.join(', ')}]`);
        if (!ok) {
          console.log(`        RAW: ${JSON.stringify(raw).slice(0, 360)}`);
          console.log(`        SANITIZED: ${JSON.stringify(sanitized).slice(0, 360)}`);
        }
      }
    }
    console.log(`\n${agg.pass}/${agg.total} clean · pollute=${agg.pollute} presentMiss=${agg.presentMiss} absentLeak=${agg.absentLeak} dirMiss=${agg.dirMiss} adhocMiss=${agg.adhocMiss} sanitizeLeak=${agg.sanitizeLeak} revealClobber=${agg.revealClobber} invented=${agg.solo}\n`);
    expect(agg.total).toBeGreaterThan(0);
  }, 600_000);
});
