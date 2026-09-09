import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import VRMViewer from '@/views/VRMViewer';
import { MobileControlsDrawer } from '@/components/MobileControlsDrawer';
import { useVrmCustomization } from '@/lib/useVrmCustomization';
import { useIsMobile } from '@/lib/useIsMobile';
import { useBackStop } from '@/hooks/useBackStop';
import { VrmFileDetails, Row } from '@/components/VrmFileDetails';
import type { VrmLicense } from '@/types';
import { gateAvatarLicense, type AvatarLicenseRequirement } from '@/lib/avatarLicenseGate';

/** Player-facing name for each Permissive License requirement, named only when it fails — a passing
 *  requirement is never called out (see `avatarLicenseGate.ts` for the identifiers themselves). */
const REQUIREMENT_LABELS: Record<AvatarLicenseRequirement, string> = {
  metaVersion: 'VRM 1.0 metadata',
  avatarPermission: 'permission for everyone to use it',
  allowRedistribution: 'redistribution allowed',
  modification: 'modification and redistribution allowed',
  commercialUsage: 'commercial use allowed',
};

/**
 * A model's 3D preview and everything its file says about itself, in the layout both VRM surfaces share: the
 * library's details modal and the World Editor's player-model preview. Read-only — it's a details panel rather
 * than an editor. The caller owns where the bytes come from and passes a ready object/data URL; anything extra
 * that varies per surface (each one's Export button, which resolves its bytes differently) goes in `footer`.
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
  // The mobile overlay is not a Radix layer, so the Android back button cannot see it and closes it here.
  useBackStop(isMobile && open ? onClose : undefined);

  // Absence is failure, same as every other license read: a model whose license hasn't resolved yet gates
  // exactly like a plain glTF would, never like a pass.
  const verdict = gateAvatarLicense(license ?? { metaVersion: null });

  // Keyed on the url so switching models rebuilds the scene rather than reusing the old one.
  const preview = failed ? (
    <div className="h-full flex items-center justify-center p-4">
      <p className="text-helper text-muted-foreground text-center">This player avatar couldn&apos;t be loaded.</p>
    </div>
  ) : url ? (
    <VRMViewer key={url} ref={vrmViewerRef} {...viewerProps} modelUrl={url} onCapabilities={setCaps} />
  ) : (
    <div className="h-full flex items-center justify-center">
      <p className="text-helper text-muted-foreground">Loading Player Avatar…</p>
    </div>
  );

  const info = (
    <VrmFileDetails license={license} size={size ?? 0}>
      <Row label="Community Creations">
        {verdict.allowed
          ? <span className="text-success">Shareable</span>
          : <span className="text-destructive">Not shareable</span>}
      </Row>

      {!verdict.allowed && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Needs {verdict.failedRequirements.map((id) => REQUIREMENT_LABELS[id]).join(', ')} to publish to
          Community Creations.
        </p>
      )}
    </VrmFileDetails>
  );

  // The mobile path is a plain overlay rather than a Radix dialog, so it has no exit transition to preserve
  // and can unmount outright. The desktop dialog must stay mounted with `open={false}` for its close
  // animation to play.
  if (isMobile) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <h2 className="truncate text-title font-semibold">{name}</h2>
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
