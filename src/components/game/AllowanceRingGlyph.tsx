import type { AllowanceTone } from '@/lib/hostedAi/allowanceFigure';

const TONE_CLASS: Record<AllowanceTone, string> = {
  normal: 'text-primary',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

/** The ring on its own: a track, and an arc from the top that `percent` fills. Null draws the track alone. */
export function AllowanceRingGlyph({ percent, tone }: { percent: number | null; tone: AllowanceTone }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90" fill="none" strokeWidth={3} aria-hidden data-allowance-glyph>
      <circle cx="12" cy="12" r="9" stroke="currentColor" className="text-muted-foreground/30" />
      {percent !== null && percent > 0 && (
        <circle
          cx="12" cy="12" r="9" stroke="currentColor" pathLength={100} strokeDasharray={`${percent} 100`}
          className={TONE_CLASS[tone]} data-allowance-fill={tone}
        />
      )}
    </svg>
  );
}
