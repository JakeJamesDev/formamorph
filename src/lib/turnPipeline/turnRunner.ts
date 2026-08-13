import type { AiStreamEvent } from '@/lib/aiRequest/aiStream';
import type {
  TurnMaterial,
  TurnPassRecord,
  TurnPassRequest,
  TurnPassSubject,
  TurnPlan,
  TurnStage,
} from './turnPlan';
import { classifyTurnError, type TurnErrorKind } from './turnErrors';

/**
 * The Turn Pipeline's runner: it executes one {@link TurnPlan} — the up-front router, the planning stages,
 * the narration, and every post-narration pass — through a single injected request adapter, and answers
 * with a typed result rather than a thrown error.
 *
 * Both concurrency modes take the same path: a stage is either dispatched as one batch or one pass at a
 * time, and that is the only thing the knob decides. Narration stream events are forwarded verbatim, in
 * arrival order, so reveal pacing and TTS stay in the view.
 */

/** What one dispatched request produced. Fan-out passes contribute one of these per subject. */
export interface TurnPassOutcome {
  id: TurnPassRecord['id'];
  /** The being this request was about, for a fan-out pass. */
  subject?: TurnPassSubject;
  request: TurnPassRequest;
  /** The adapter's answer, verbatim. Empty when the request failed. */
  raw: string;
  /** The pass's own read of the answer, as its own parser returned it. Null when the request failed. */
  parsed: unknown;
  /** Why this request produced nothing. Only a batched pass can carry one — elsewhere a failure ends the turn. */
  error?: unknown;
}

/** Everything one run of a turn produced, however it ended. */
export interface TurnRun {
  /** The material as the turn left it, with each stage's answers folded in. */
  material: TurnMaterial;
  /** Every dispatched request's outcome, in dispatch order. */
  passes: TurnPassOutcome[];
}

/**
 * How a turn ended. `aborted` is the player stopping — an expected, silent exit. `failed` names why in a
 * kind the view maps to guidance; the partial run comes back either way.
 */
export type TurnResult =
  | { status: 'ok'; run: TurnRun }
  | { status: 'aborted'; run: TurnRun }
  | { status: 'failed'; kind: TurnErrorKind; error: unknown; run: TurnRun };

/** What the adapter is told beyond the request itself. */
export interface TurnRequestContext {
  signal: AbortSignal;
  /** Set for the narration only: the stream's events, as they arrive. */
  onEvent?: (event: AiStreamEvent) => void;
}

/** The pipeline's one seam: production sends the real AI call, tests a fake, the harness a recorder. */
export type TurnRequestAdapter = (request: TurnPassRequest, context: TurnRequestContext) => Promise<string>;

/** Where the runner asks the caller to fold its own knowledge into the turn. */
export type TurnAdvanceEvent =
  /** Before a stage's passes are built, so the caller can scope what they render against. */
  | { at: 'stage'; stage: TurnStage }
  /** After a pass has answered — all of its subjects, for a fan-out pass. */
  | { at: 'pass'; outcomes: TurnPassOutcome[] };

/**
 * The caller's derivation step: given what the turn has produced so far, what it adds to the material. It
 * is where world knowledge (entities, history, context values) enters, never where requests do — the
 * adapter is the only seam for those. Awaited, so a stage boundary can also be where the caller holds the
 * turn: the narration's read-aloud pass has to finish before the post-narration batch competes with it for
 * the graphics card.
 */
export type TurnAdvance = (
  event: TurnAdvanceEvent,
  material: TurnMaterial,
) => Partial<TurnMaterial> | void | Promise<Partial<TurnMaterial> | void>;

export interface TurnRunnerInput {
  plan: TurnPlan;
  /** The material the turn starts from; the runner folds each stage's answers into a copy of it. */
  material: TurnMaterial;
  request: TurnRequestAdapter;
  signal: AbortSignal;
  advance?: TurnAdvance;
  /** The narration stream's events, forwarded in the order the stream emitted them. */
  onNarrationEvent?: (event: AiStreamEvent) => void;
}

/** Stage order. Every turn walks all four; a stage with no due passes simply dispatches nothing. */
const STAGES: TurnStage[] = ['preNarration', 'planning', 'narration', 'postNarration'];

/** One request to send: the pass that owns it, the subject it is about, and the built payload. */
interface PlannedRequest {
  pass: TurnPassRecord;
  subject?: TurnPassSubject;
  request: TurnPassRequest;
}

/**
 * The post-narration passes are the only ones the concurrency knob batches: they depend on the narration
 * and on nothing from each other. Batched, one failure is absorbed and the drainers backfill it later;
 * dispatched one at a time, a failure ends the turn.
 */
const isBatched = (stage: TurnStage, plan: TurnPlan): boolean =>
  stage === 'postNarration' && plan.concurrency === 'parallel';

export async function runTurn(input: TurnRunnerInput): Promise<TurnResult> {
  const { plan, request, signal, advance, onNarrationEvent } = input;
  let material: TurnMaterial = { ...input.material };
  const passes: TurnPassOutcome[] = [];
  const run = (): TurnRun => ({ material, passes });

  const applyAdvance = async (event: TurnAdvanceEvent): Promise<void> => {
    const patch = await advance?.(event, material);
    if (patch) material = { ...material, ...patch };
  };

  /** The requests a pass sends this turn: one per subject when it fans out, one otherwise, none when it
   *  is due but has nothing to ask about. */
  const requestsFor = (pass: TurnPassRecord): PlannedRequest[] => {
    if (pass.isReady && !pass.isReady(material)) return [];
    if (!pass.fanOut) {
      return [{ pass, request: pass.buildRequest(plan.input, material) }];
    }
    const subjects = material.subjects?.[pass.id] ?? [];
    return subjects.map((subject) => {
      const scoped = { ...material, subject };
      return { pass, subject, request: pass.buildRequest(plan.input, scoped) };
    });
  };

  const send = (planned: PlannedRequest): Promise<string> =>
    request(planned.request, {
      signal,
      ...(planned.pass.stage === 'narration' && onNarrationEvent ? { onEvent: onNarrationEvent } : {}),
    });

  const envelope = (planned: PlannedRequest) => ({
    id: planned.pass.id,
    ...(planned.subject ? { subject: planned.subject } : {}),
    request: planned.request,
  });

  /** Read an answer through the pass that asked for it, with the subject its parser may need. */
  const outcomeOf = (planned: PlannedRequest, raw: string): TurnPassOutcome => ({
    ...envelope(planned),
    raw,
    parsed: planned.pass.parseResponse(raw, { ...material, subject: planned.subject }),
  });

  const failedOutcome = (planned: PlannedRequest, error: unknown): TurnPassOutcome => ({
    ...envelope(planned),
    raw: '',
    parsed: null,
    error,
  });

  try {
    for (const stage of STAGES) {
      if (signal.aborted) return { status: 'aborted', run: run() };
      await applyAdvance({ at: 'stage', stage });
      const stagePasses = plan.passes.filter((pass) => pass.stage === stage);
      if (stagePasses.length === 0) continue;

      if (isBatched(stage, plan)) {
        // One batch: every request the stage sends, in plan order, dispatched together and settled together.
        const planned = stagePasses.flatMap(requestsFor);
        const settled = await Promise.allSettled(planned.map(send));
        if (signal.aborted) return { status: 'aborted', run: run() };
        // A failed request contributes an empty outcome rather than ending the turn — its feature is either
        // backfilled by an idle drainer or simply absent this turn.
        const batch = planned.map((entry, i) => {
          const answer = settled[i];
          return answer.status === 'fulfilled' ? outcomeOf(entry, answer.value) : failedOutcome(entry, answer.reason);
        });
        passes.push(...batch);
        // A pass that sent nothing has nothing to advance from, exactly as when it is dispatched alone.
        for (const pass of stagePasses) {
          const outcomes = batch.filter((outcome) => outcome.id === pass.id);
          if (outcomes.length > 0) await applyAdvance({ at: 'pass', outcomes });
        }
        continue;
      }

      // One pass at a time. A fan-out pass still sends its subjects together when the knob says parallel —
      // they are independent of each other, and only the pass boundary is sequential.
      for (const pass of stagePasses) {
        const planned = requestsFor(pass);
        if (planned.length === 0) continue;
        const outcomes: TurnPassOutcome[] = [];
        if (plan.concurrency === 'parallel') {
          const answers = await Promise.all(planned.map(send));
          if (signal.aborted) return { status: 'aborted', run: run() };
          outcomes.push(...planned.map((entry, i) => outcomeOf(entry, answers[i])));
        } else {
          for (const entry of planned) {
            const raw = await send(entry);
            if (signal.aborted) return { status: 'aborted', run: run() };
            outcomes.push(outcomeOf(entry, raw));
          }
        }
        passes.push(...outcomes);
        if (pass.stage === 'narration') {
          const narration = outcomes[0].raw;
          // An empty narration is not a stop: the model returned nothing, or spent the whole response on
          // reasoning. There is no story text to play, so the turn cannot advance and nothing downstream runs.
          if (!narration) {
            return { status: 'failed', kind: 'emptyNarration', error: null, run: run() };
          }
          material = { ...material, narration };
        }
        await applyAdvance({ at: 'pass', outcomes });
      }
    }
  } catch (error) {
    // A stopped turn is stopped however the adapter left — an abort that surfaces as a rejection is still
    // the player's silent exit, not a failure to explain.
    if (signal.aborted) return { status: 'aborted', run: run() };
    return { status: 'failed', kind: classifyTurnError(error), error, run: run() };
  }

  // No tail abort check: every await above is followed by one, and nothing between the last of them and
  // here can await, so a stop can only land where it is already read.
  return { status: 'ok', run: run() };
}
