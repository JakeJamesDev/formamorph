import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { SectionTitle } from '@/components/ui/typography';
import { HostedPresetStatus } from '@/components/modals/HostedPresetStatus';
import { useSettings } from '@/contexts/SettingsContext';
import { AllowanceRingGlyph } from './AllowanceRingGlyph';
import {
  allowanceFigure, allowanceFigureMoves, allowanceTone,
  type AllowanceFigure, type AllowanceHoldInputs,
} from '@/lib/hostedAi/allowanceFigure';
import { DEV_ALLOWANCE_ROUTES, DEV_HOSTED_SAMPLES, type DevAllowanceRoute } from '@/lib/hostedAi/devHostedSamples';
import type { HostedSnapshot } from '@/lib/hostedAi/hostedSession';
import { useDevRoute } from '@/lib/devRouter';
import { cn } from '@/lib/utils';

/** Outlives the ring, because a mobile tab change or Hide UI unmounts it mid-turn. */
let hold: { inputs: AllowanceHoldInputs; figure: AllowanceFigure } | null = null;

/** The live figure, held while `busy`; see `allowanceFigureMoves` for what releases it. */
function useHeldFigure(snapshot: HostedSnapshot, busy: boolean): AllowanceFigure {
  const live = allowanceFigure(snapshot);
  const inputs = { busy, readCount: snapshot.readCount, presetState: snapshot.presetState };
  const figure = !hold || allowanceFigureMoves(hold.inputs, inputs) ? live : hold.figure;
  hold = { inputs, figure };
  return figure;
}

/** The accessible name, which also serves as the tooltip. */
const ringLabel = (percent: number | null) =>
  percent === null ? 'Formamorph AI Allowance' : `Formamorph AI Allowance: ${Math.round(percent)}% used`;

function RingControl({ figure, preview, busy, className }: {
  figure: AllowanceFigure;
  preview?: DevAllowanceRoute;
  busy: boolean;
  className?: string;
}) {
  const { refreshHostedState } = useSettings();
  const [open, setOpen] = useState(false);
  const label = ringLabel(figure.percent);

  // A popover left open through a turn reads again, so its breakdown matches the ring that just moved.
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy && open && !preview) void refreshHostedState();
    wasBusy.current = busy;
  }, [busy, open, preview, refreshHostedState]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip tip={label} labelsChild={false}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={label}
            className={cn('flex-shrink-0', className)}
            data-allowance-ring={figure.presetState}
          >
            <AllowanceRingGlyph percent={figure.percent} tone={allowanceTone(figure.percent, figure.warnThresholds)} />
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent side="top" align="end" className="w-80 p-0">
        <ScrollArea className="max-h-[min(32rem,var(--radix-popover-content-available-height))]">
          <div className="flex flex-col gap-3 p-4">
            <SectionTitle>Formamorph AI</SectionTitle>
            <HostedPresetStatus state={preview?.state} sample={preview?.sample} className="py-0" />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/** DEV: the ring in one canned state, for the dev route. Reads nothing. */
function AllowanceRingPreview({ preview, className }: { preview: DevAllowanceRoute; className?: string }) {
  const { hostedAi } = useSettings();
  const sample = preview.sample ?? DEV_HOSTED_SAMPLES[preview.state];
  const figure = allowanceFigure({
    ...hostedAi,
    presetState: preview.state,
    // A sample holds only the usage fields, and the figure reads no others.
    hosted: sample ? { ...hostedAi.hosted, ...sample } as HostedSnapshot['hosted'] : null,
  });
  return <RingControl figure={figure} preview={preview} busy={false} className={className} />;
}

/** How much of the week's Formamorph AI allowance is used, between Help and Send. Shows only while a prompt can use it. */
export function AllowanceRing({ busy, className }: { busy: boolean; className?: string }) {
  const { hostedAi, hostedInUse } = useSettings();
  const figure = useHeldFigure(hostedAi, busy);
  const devRoute = useDevRoute();
  const preview = import.meta.env.DEV && devRoute?.allowance ? DEV_ALLOWANCE_ROUTES[devRoute.allowance] : undefined;

  if (preview) return <AllowanceRingPreview preview={preview} className={className} />;
  if (!hostedInUse) return null;
  return <RingControl figure={figure} busy={busy} className={className} />;
}
