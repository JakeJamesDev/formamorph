import type { ReactNode } from 'react';
import { ArrowUpToLine, Brain, ChevronDown, ChevronRight, Info, Route, Server, SlidersHorizontal, TextCursor, Timer, Zap } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tip } from '@/components/ui/tooltip';
import { RequestAnatomyView } from '@/components/game/RequestAnatomyView';
import { ToolRoundsView } from '@/components/game/ToolRoundsView';
import { StillGlyph } from '@/components/game/statusGlyphs/StatusGlyph';
import { FALLBACK_STATUS, REQUEST_STATUS } from '@/components/game/statusGlyphs/glyphMap';
import { LENGTH_FINISH_REASON } from '@/lib/aiRequest/aiStream';
import { REQUEST_LABELS } from '@/lib/promptGroups';
import { toAnatomyBlocks } from '@/lib/requestAnatomy';
import type { AiRequestRecord } from '@/lib/aiContext/requestRecord';
import type { AiRequestStats } from '@/lib/aiContext/requestStats';
import type { DebugEndpointInfo } from '@/lib/promptEndpoints';
import type { AIRequestType } from '@/types';
import { Hint } from '@/components/ui/typography';
import { RequestStat } from './RequestStat';
import { reasoningText, samplersText, secondsText, speedText } from './requestLineText';

/** The collapsibles of one card. `group` is the whole card. */
export type AiContextCardSection = 'group' | 'input' | 'tools' | 'reasoning' | 'output';

/** Where one slice of text is in its record, so a highlighter can address the block it belongs to. */
export interface AiContextTextSlot {
  part: 'input' | 'reasoning' | 'output';
  /** The anatomy block for `input`; always 0 for the other parts. */
  blockIndex: number;
  /** Where the slice begins inside its block. */
  start: number;
}

export interface AiContextRequestCardProps {
  record: AiRequestRecord;
  /** The request's position among its siblings, 0-based; the title counts from 1. */
  index: number;
  /** A search found nothing in this request, so the title says so. */
  folded?: boolean;
  isOpen: (section: AiContextCardSection) => boolean;
  onOpenChange: (section: AiContextCardSection, open: boolean) => void;
  renderText?: (text: string, slot: AiContextTextSlot) => ReactNode;
  /** The caller's own chips, drawn after the endpoint chips in the header. */
  chips?: ReactNode;
}

const TRIGGER = 'flex w-full items-center justify-between gap-2 p-2 text-left font-semibold';
const BOX = 'border border-border rounded-md';
const TEXT_BLOCK = 'whitespace-pre-wrap break-words text-label rounded-lg border border-border p-3';

function Chevron({ open }: { open: boolean }) {
  return open ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />;
}

/** The endpoint chip, the one block on the line, then what the request sent. */
function SentStats({ endpoint }: { endpoint: DebugEndpointInfo }) {
  const EndpointIcon = endpoint.routed ? Route : Server;
  const reasoning = reasoningText(endpoint);
  const samplers = samplersText(endpoint);
  return (
    <>
      <Tip tip={`${endpoint.model} · ${endpoint.url}`} labelsChild={false}>
        <span
          // The routed chip is marked by a tinted border + its icon, not by colored text:
          // `primary` is a pale accent that all but vanishes as text on a light surface.
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-meta font-normal ${
            endpoint.routed
              ? 'border border-primary/60 bg-primary/15 text-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <EndpointIcon className="h-3 w-3 flex-shrink-0" aria-hidden />
          {endpoint.preset} · {endpoint.model}
        </span>
      </Tip>
      {reasoning && <RequestStat icon={Brain} name="Reasoning" value={reasoning.value} tip={reasoning.tip} />}
      {endpoint.maxTokens !== undefined && (
        <RequestStat icon={ArrowUpToLine} name="Max Output" value={endpoint.maxTokens.toLocaleString()} tip={`Max Output · max_tokens: ${endpoint.maxTokens}`} />
      )}
      {samplers && <RequestStat icon={SlidersHorizontal} name="Samplers" value={samplers.value} tip={samplers.tip} />}
    </>
  );
}

/** What came back. From `sm` up the columns hold their width, so values line up from card to card. */
function ResultStats({ stats }: { stats: AiRequestStats }) {
  const speed = speedText(stats);
  return (
    <span className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      {stats.finishReason === LENGTH_FINISH_REASON && (
        <RequestStat icon={Info} name="Note" value="Reached Max Output" tip="The AI would have written more, but this reply reached its Max Output" />
      )}
      {speed && <RequestStat icon={Zap} name="Speed" value={speed.value} tip={speed.tip} className="justify-end sm:min-w-[4.75rem]" />}
      <RequestStat icon={Timer} name="Total Time" value={secondsText(stats.totalMs)} tip={`Total time: ${secondsText(stats.totalMs)}`} className="justify-end sm:min-w-[3.75rem]" />
      {stats.firstTokenMs !== null && (
        <RequestStat icon={TextCursor} name="First Token" value={secondsText(stats.firstTokenMs)} tip={`First token after ${secondsText(stats.firstTokenMs)}`} className="justify-end sm:min-w-[3.75rem]" />
      )}
    </span>
  );
}

/** A titled collapsible section of an AI Context viewer: the card's own, and any block a caller sets beside its cards. */
export function AiContextSection({ title, open, onOpenChange, children }: { title: string; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className={BOX}>
      <CollapsibleTrigger asChild>
        <button className={TRIGGER}>
          <span>{title}</span>
          <Chevron open={open} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-2 pt-0">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/**
 * One request of an AI Context viewer: the header with its endpoint chips, then the Raw Input drawn as its
 * Request Anatomy, the Tool Rounds, the Raw Reasoning and the Raw Output, each a collapsible of its own.
 *
 * Shared by the game view and Formaquestion. The caller owns every open state, so a find bar can open the
 * section that hides a hit, and `renderText` is the caller's highlighter; the card draws plain text without it.
 */
export function AiContextRequestCard({ record, index, folded, isOpen, onOpenChange, renderText, chips }: AiContextRequestCardProps) {
  const text = (value: string, slot: AiContextTextSlot) => (renderText ? renderText(value, slot) : value);
  const groupOpen = isOpen('group');
  // A help request names itself, so its type is no request kind.
  const kind = record.type as AIRequestType;
  const status = REQUEST_STATUS[kind] ?? FALLBACK_STATUS;
  // The text-pass mark is a notice, and skipped entities get their own line.
  const skippedEntities = record.statDiagnostics?.filter(({ reason }) => reason === 'skipped') ?? [];
  const skippedUpdates = record.statDiagnostics?.filter(({ reason }) => reason !== 'textPass' && reason !== 'skipped') ?? [];
  return (
    <Collapsible open={groupOpen} onOpenChange={(o) => onOpenChange('group', o)} className={BOX}>
      <CollapsibleTrigger asChild>
        <button className={TRIGGER}>
          <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Tip tip={record.type} labelsChild={false}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex-shrink-0 text-muted-foreground"><StillGlyph glyph={status.glyph} /></span>
                  <span>
                    {REQUEST_LABELS[kind] ?? record.type}{' '}
                    <span className="font-normal text-muted-foreground">· #{index + 1}</span>
                    {folded && <span className="font-normal text-muted-foreground"> · no matches</span>}
                  </span>
                </span>
              </Tip>
              {record.endpoint && <SentStats endpoint={record.endpoint} />}
              {chips}
            </span>
            {record.stats && <ResultStats stats={record.stats} />}
          </span>
          <Chevron open={groupOpen} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 p-2 pt-0">
        <AiContextSection title="Raw Input" open={isOpen('input')} onOpenChange={(o) => onOpenChange('input', o)}>
          {/* Every request gets the region/chat shape. A missing anatomy sidecar just means no runs, which
              `plain` never draws anyway. Provenance reading lives in the Settings anatomy hub. */}
          <RequestAnatomyView
            blocks={toAnatomyBlocks(record.messages, record.anatomy)}
            mode="resolved"
            plain
            renderText={(value, _block, blockIndex, start) => text(value, { part: 'input', blockIndex, start })}
          />
        </AiContextSection>
        {!!record.toolRounds?.length && (
          <AiContextSection title="Tool Rounds" open={isOpen('tools')} onOpenChange={(o) => onOpenChange('tools', o)}>
            <ToolRoundsView rounds={record.toolRounds} />
          </AiContextSection>
        )}
        {record.reasoning && (
          <AiContextSection title="Raw Reasoning" open={isOpen('reasoning')} onOpenChange={(o) => onOpenChange('reasoning', o)}>
            <p className={TEXT_BLOCK}>{text(record.reasoning, { part: 'reasoning', blockIndex: 0, start: 0 })}</p>
          </AiContextSection>
        )}
        {typeof record.response === 'string' && (
          <AiContextSection title="Raw Output" open={isOpen('output')} onOpenChange={(o) => onOpenChange('output', o)}>
            {/* Same face as the Raw Input blocks: this is the same conversation, read top to bottom. */}
            <p className={TEXT_BLOCK}>
              {record.response ? (
                text(record.response, { part: 'output', blockIndex: 0, start: 0 })
              ) : (
                <span className="text-muted-foreground">(empty output)</span>
              )}
            </p>
            {record.statDiagnostics?.some(({ reason }) => reason === 'textPass') && (
              <Hint className="mt-2">The stat reply was plain text instead of JSON</Hint>
            )}
            {skippedEntities.length > 0 && (
              <Hint className="mt-2 whitespace-pre-wrap break-words">
                Skipped entity stats: {skippedEntities.map(({ name }) => name).join(', ')}
              </Hint>
            )}
            {skippedUpdates.length > 0 && (
              <Hint className="mt-2 whitespace-pre-wrap break-words">
                Skipped stat updates: {skippedUpdates.map(({ name, reason }) => `${name} (${reason})`).join('; ')}
              </Hint>
            )}
          </AiContextSection>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
