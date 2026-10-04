/**
 * The trace of one help question, as Formaquestion's AI Context shows it: the search that found the docs
 * sections, and each request with its endpoint details. The help session fills it; the window keeps it in
 * memory with the conversation.
 */
import type { AiRequestRecord } from '@/lib/aiContext/requestRecord';
import type { DocSection } from '@/lib/docs/docsIndex';
import type { HelpSources } from './helpSettings';

/** A search source of a help question. */
export type HelpSource = keyof HelpSources;

/** The most sections of each source's ranking, and of the merged order, one query keeps. */
export const HELP_TRACE_DEPTH = 10;

/** A docs section as the trace names it: enough to list it and open it, without its text. */
export type HelpTraceSection = Pick<DocSection, 'id' | 'page' | 'label'>;

/** The sections one source ranked for one query, best first, cut to the trace depth. */
export interface HelpSourceTrace {
  source: HelpSource;
  sections: HelpTraceSection[];
}

/** One query the search ran: each source's ranking, then the merged order. */
export interface HelpQueryTrace {
  query: string;
  /** One row per source that was on. A failed pick, or a semantic source with no model, has no sections. */
  sources: HelpSourceTrace[];
  /** The merged order, cut to the trace depth; every section that reached the model stays in. */
  merged: HelpTraceSection[];
}

/** The sampler values one request carried, in the settings' names. Absent where the body sent none. */
export interface HelpSamplers {
  temperature?: number;
  repetitionPenalty?: number;
  topP?: number;
  topK?: number;
  minP?: number;
}

/** Each sampler: its name here, the wire field the session reads it from, and the label the chip shows. */
export const HELP_SAMPLER_FIELDS: readonly { key: keyof HelpSamplers; wire: string; label: string }[] = [
  { key: 'temperature', wire: 'temperature', label: 'Temp' },
  { key: 'repetitionPenalty', wire: 'repetition_penalty', label: 'Rep' },
  { key: 'topP', wire: 'top_p', label: 'Top P' },
  { key: 'topK', wire: 'top_k', label: 'Top K' },
  { key: 'minP', wire: 'min_p', label: 'Min P' },
];

/** One request of a help question: the shared record, plus what the help card marks beside its endpoint. */
export interface HelpRequestTrace {
  record: AiRequestRecord;
  samplers: HelpSamplers;
  /** The prompt this request carried differs from the default text. */
  customPrompt: boolean;
}

/** The search of one question. The session fills it as the search runs. */
export interface HelpSearchTrace {
  /** The sources that were on. */
  on: HelpSource[];
  queries: HelpQueryTrace[];
  /** The AI Search request, when that source was on. */
  pick: HelpRequestTrace | null;
}

export interface HelpTrace {
  /** The screen the player asked from, in player words. Null when none was known. */
  surface: string | null;
  /** Use the Open Screen was on. */
  openScreen: boolean;
  /** The open screen's section, when the setting was on and a section explains the screen. */
  lead?: HelpTraceSection;
  /** The active help preset's name. */
  preset: string;
  /** Null for a bare question, which runs no search. */
  search: HelpSearchTrace | null;
  /** The sections that reached the model in the prompt, in order. */
  sent: HelpTraceSection[];
  /** The AI Search request, when it ran, then the answer request. */
  requests: HelpRequestTrace[];
}

/** The trace's view of a section. */
export const traceSection = ({ id, page, label }: DocSection): HelpTraceSection => ({ id, page, label });

/** What the search of one question ranked, in full, before the trace cuts it. The session fills it as the search runs. */
export interface HelpSearchRecord {
  on: HelpSource[];
  queries: { query: string; sources: { source: HelpSource; sections: DocSection[] }[]; merged: DocSection[] }[];
  pick: HelpRequestTrace | null;
}

export const emptySearchRecord = (on: HelpSource[]): HelpSearchRecord => ({ on, queries: [], pick: null });

/** Adds one query's results to the record. A query the record holds already is kept as it was. */
export function recordQuery(record: HelpSearchRecord, query: HelpSearchRecord['queries'][number]): void {
  if (!record.queries.some((known) => known.query === query.query)) record.queries.push(query);
}

/** A ranking cut to the trace depth, with every section that reached the model kept past the cut. */
function cutToDepth(sections: readonly DocSection[], sent: ReadonlySet<string>): HelpTraceSection[] {
  return sections.filter((section, at) => at < HELP_TRACE_DEPTH || sent.has(section.id)).map(traceSection);
}

/** The search trace of a question: the record cut to the trace depth, with the sent sections kept. */
export function searchTraceOf(record: HelpSearchRecord, sent: readonly DocSection[]): HelpSearchTrace {
  const sentIds = new Set(sent.map((section) => section.id));
  return {
    on: record.on,
    pick: record.pick,
    queries: record.queries.map(({ query, sources, merged }) => ({
      query,
      sources: sources.map(({ source, sections }) => ({ source, sections: cutToDepth(sections, sentIds) })),
      merged: cutToDepth(merged, sentIds),
    })),
  };
}
