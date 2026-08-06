import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import VRMViewer from '@/views/VRMViewer';
import { MobileControlsDrawer } from '@/components/MobileControlsDrawer';
import { useVrmCustomization } from '@/lib/useVrmCustomization';
import { useIsMobile } from '@/lib/useIsMobile';
import { formatBytes } from '@/lib/imageOptim';
import type { VrmLicense } from '@/types';

/** One label/value row of the details column. `min-w-0` on the value cell lets a long value truncate rather
 *  than forcing the panel wider (grid tracks default to `min-width: auto`). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-xs min-w-0">{children}</span>
    </div>
  );
}

/** Stands in wherever a model told us nothing — absent metadata is unknown, never permission. */
const Unknown = () => <span className="text-muted-foreground italic">Unknown</span>;

/** VRM 1.0's commercial-use options are finer than 0.0's allow/disallow; name each in the author's terms. */
const COMMERCIAL_LABELS: Record<NonNullable<VrmLicense['commercialUse']>, string> = {
  allow: 'Allowed',
  disallow: 'Not allowed',
  personalNonProfit: 'Personal, non-profit only',
  personalProfit: 'Personal, profit allowed',
  corporation: 'Allowed, including commercial',
};

const TONE_CLASS = { good: 'text-success', bad: 'text-destructive' } as const;

/** Yes/no/unknown flag. Each branch names its own tone, since which side is the good news differs per field:
 *  redistribution-not-allowed is a restriction (bad), but credit-not-required is a freedom (good). A missing
 *  flag reads as "unknown", never as a "no". */
function Flag({ value, yes, no }: {
  value?: boolean;
  yes: { label: string; tone?: keyof typeof TONE_CLASS };
  no: { label: string; tone?: keyof typeof TONE_CLASS };
}) {
  if (value === undefined) return <Unknown />;
  const { label, tone } = value ? yes : no;
  return <span className={tone && TONE_CLASS[tone]}>{label}</span>;
}

/**
 * A model's 3D preview and everything its file says about itself, in the layout both VRM surfaces share: the
 * library's details modal and the World Editor's player-model preview. Read-only — it's a details panel rather
 * than an editor. The caller owns where the bytes come from and passes a ready object/data URL; anything extra
 * that belongs to one surface only (the library's Export button) goes in `footer`.
 *
 * Portrait/narrow: the model fills the screen and its info + controls move into a bottom sheet, mirroring the
 * character-customization step. A standalone full-screen overlay (not a nested Dialog) keeps the vaul drawer
 * out of a Radix focus trap. Desktop keeps the side-by-side dialog.
 */
export function ModelDetailsPanel({ open, name, url, license, size, failed = false, footer, onClose }: {
  open: boolean;
  name: string;
  /** Object or data URL for the model's bytes; undefined while they're still being resolved. */
  url?: string;
  license?: VrmLicense;
  size?: number;
  /** The bytes couldn't be resolved — shown in place of the viewer. */
  failed?: boolean;
  /** Surface-specific action pinned below the controls (desktop) or at the sheet's end (mobile). */
  footer?: ReactNode;
  onClose: () => void;
}) {
  // The same slider/color surface the enter-world flow uses, so a creator can test that a model's morphs
  // actually respond here.
  const { setCaps, vrmViewerRef, viewerProps, controls } = useVrmCustomization();
  const isMobile = useIsMobile();

  const authors = license?.authors?.length ? license.authors.join(', ') : null;

  // Keyed on the url so switching models rebuilds the scene rather than reusing the old one.
  const preview = failed ? (
    <div className="h-full flex items-center justify-center p-4">
      <p className="text-sm text-muted-foreground text-center">This player avatar couldn&apos;t be loaded.</p>
    </div>
  ) : url ? (
    <VRMViewer key={url} ref={vrmViewerRef} {...viewerProps} modelUrl={url} onCapabilities={setCaps} />
  ) : (
    <div className="h-full flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading Player Avatar…</p>
    </div>
  );

  const info = (
    <div>
      <Row label="Author">{authors ?? <Unknown />}</Row>
      <Row label="Format">
        {license?.metaVersion === null
          ? 'glTF (no VRM data)'
          : `VRM ${license?.metaVersion === '0' ? '0.0' : '1.0'}`}
      </Row>
      <Row label="Size">{formatBytes(size ?? 0)}</Row>
      <Row label="License">
        {license?.licenseName ?? (license?.licenseUrl
          ? <a href={license.licenseUrl} target="_blank" rel="noopener noreferrer" title={license.licenseUrl} className="block truncate underline hover:text-foreground">{license.licenseUrl}</a>
          : <Unknown />)}
      </Row>
      <Row label="Redistribution">
        <Flag value={license?.allowRedistribution} yes={{ label: 'Allowed', tone: 'good' }} no={{ label: 'Not allowed', tone: 'bad' }} />
      </Row>
      <Row label="Commercial use">
        {license?.commercialUse ? COMMERCIAL_LABELS[license.commercialUse] : <Unknown />}
      </Row>
      <Row label="Credit">
        <Flag value={license?.creditRequired} yes={{ label: 'Required' }} no={{ label: 'Not required', tone: 'good' }} />
      </Row>

      {license?.metaVersion === null && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          A plain glTF file carries no license information, and isn&apos;t guaranteed to pose or morph like a VRM.
        </p>
      )}
      {license?.creditRequired && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          This model&apos;s author asks to be credited wherever it appears.
        </p>
      )}
    </div>
  );

  // The mobile path is a plain overlay rather than a Radix dialog, so it has no exit transition to preserve
  // and can unmount outright. The desktop dialog must stay mounted with `open={false}` for its close
  // animation to play.
  if (isMobile) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <h2 className="truncate text-lg font-semibold">{name}</h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="relative flex-1 min-h-0 bg-muted/30">{preview}</div>
        <MobileControlsDrawer title={name} triggerLabel="Details & sliders">
          {info}
          {controls}
          {footer}
        </MobileControlsDrawer>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-[900px] w-[95vw] h-[85dvh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b">
          {/* `leading-normal` replaces DialogTitle's `leading-none`, whose one-em line box crops
              descenders under `truncate`'s overflow clip. */}
          <DialogTitle className="truncate leading-normal">{name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-row">
          <div className="flex-1 min-h-0 bg-muted/30">{preview}</div>

          {/* Right column: frozen info on top, the detected controls in the only scroll region, the footer
              action pinned to the bottom so it stays reachable however many sliders a model exposes. */}
          <div className="w-72 shrink-0 border-l flex flex-col min-h-0">
            <div className="shrink-0 p-4">{info}</div>
            {/* Only region that scrolls. The controls gate themselves to the model's detected capabilities. */}
            <div className="flex-1 min-h-0 overflow-y-auto border-t px-4 py-3 space-y-6">{controls}</div>
            {footer && <div className="shrink-0 border-t p-4">{footer}</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
