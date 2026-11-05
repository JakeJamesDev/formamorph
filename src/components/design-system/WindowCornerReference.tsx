import { useState } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ART = [
  { name: 'Bright Art', background: 'linear-gradient(160deg, #fff7d6 0%, #ffd27a 55%, #f39c4a 100%)' },
  { name: 'Dark Art', background: 'linear-gradient(160deg, #0b1026 0%, #1d2a5c 55%, #3b2a6b 100%)' },
] as const;

/** A drawing of the game's top-right corner. Windows paints the real symbols. */
function Corner({ background, dimmed }: { background: string; dimmed: boolean }) {
  return (
    <div className="relative isolate h-36 overflow-hidden rounded-md border" style={{ background }}>
      <div aria-hidden className="window-corner-gradient" />
      {dimmed && <div aria-hidden className="absolute inset-0 bg-overlay/80" />}
      <div
        aria-hidden
        className={cn('absolute right-0 top-0 flex h-14 transition-colors duration-150', dimmed ? 'text-white/25' : 'text-foreground')}
      >
        {[Minus, Square, X].map((Icon, i) => (
          <span key={i} className="flex w-12 items-center justify-center">
            <Icon className="h-4 w-4" strokeWidth={1.5} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** The corner gradient and the window button dimming, from the Windows desktop app. */
export function WindowCornerReference() {
  const [dimmed, setDimmed] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Window Corner</CardTitle>
        <CardDescription>A soft gradient keeps the window buttons readable over world art. A popup&rsquo;s dimming layer fades them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {ART.map((art) => (
            <figure key={art.name} className="space-y-2">
              <Corner background={art.background} dimmed={dimmed} />
              <figcaption className="text-label text-muted-foreground">{art.name}</figcaption>
            </figure>
          ))}
        </div>
        <Button variant="outline" onClick={() => setDimmed((d) => !d)}>
          {dimmed ? 'Close Popup' : 'Open Popup'}
        </Button>
      </CardContent>
    </Card>
  );
}
