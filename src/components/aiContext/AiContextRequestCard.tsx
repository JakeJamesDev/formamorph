import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tip } from '@/components/ui/tooltip';
import { RequestAnatomyView } from '@/components/game/RequestAnatomyView';
import { ToolRoundsView } from '@/components/game/ToolRoundsView';
import { ReasoningChip } from '@/components/game/ReasoningChip';
import { MaxTokensChip } from '@/components/game/MaxTokensChip';
import { toAnatomyBlocks } from '@/lib/requestAnatomy';
import type { AiRequestRecord } from '@/lib/aiContext/requestRecord';

/** The collapsibles of one card. `group` is the whole card. */
export type AiContextCardSection = 'group' | 'input' | 'tools' | 'reasoning' | 'output';

/** Where one slice of text stands in its record, so a highlighter can address the block it belongs to. */
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
  return (
    <Collapsible open={groupOpen} onOpenChange={(o) => onOpenChange('group', o)} className={BOX}>
      <CollapsibleTrigger asChild>
        <button className={TRIGGER}>
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span>
              Request {index + 1}: {record.type}
              {folded && <span className="font-normal text-muted-foreground"> · no matches</span>}
            </span>
            {/* Which endpoint served it. A routed prompt is called out; one following the active preset
                is shown quietly, since that is the norm. */}
            {record.endpoint && (
              <>
                <Tip tip={`${record.endpoint.model} · ${record.endpoint.url}`} labelsChild={false}>
                  <span
                    // The routed chip is marked by a tinted border + the arrow, not by colored text:
                    // `primary` is a pale accent that all but vanishes as text on a light surface.
                    className={`rounded px-1.5 py-0.5 text-meta font-normal ${
                      record.endpoint.routed
                        ? 'border border-primary/60 bg-primary/15 text-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {record.endpoint.routed ? '→ ' : ''}{record.endpoint.preset} · {record.endpoint.model}
                  </span>
                </Tip>
                <ReasoningChip endpoint={record.endpoint} />
                <MaxTokensChip endpoint={record.endpoint} />
              </>
            )}
            {chips}
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
            {!!record.statDiagnostics?.length && (
              <p className="mt-2 whitespace-pre-wrap break-words text-helper text-muted-foreground">
                Skipped stat updates: {record.statDiagnostics.map(({ name, reason }) => `${name} (${reason})`).join('; ')}
              </p>
            )}
          </AiContextSection>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
