import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VRMViewer from '@/views/VRMViewer';
import ModelStorageService from '@/services/ModelStorageService';
import { formatBytes } from '@/lib/imageOptim';
import type { ModelMetadata, VrmLicense } from '@/types';

/** One label/value row of the details column. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-xs break-words">{children}</span>
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

/** Yes/no/unknown, kept consistent so a missing flag never reads as a "no". */
function Flag({ value, yes, no }: { value?: boolean; yes: string; no: string }) {
  if (value === undefined) return <Unknown />;
  return <span className={value ? undefined : 'text-destructive'}>{value ? yes : no}</span>;
}

/**
 * A model's 3D preview and everything its file says about itself. Read-only: nothing here is editable, so it's
 * a details panel rather than an editor — unlike the dictionary and character library modals.
 */
export function ModelDetailsModal({ model, onClose }: {
  model: ModelMetadata | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | undefined>();
  const [failed, setFailed] = useState(false);

  // Hold the model's bytes as an object URL only while the dialog is open; a VRM runs to tens of megabytes.
  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    let objectUrl: string | undefined;
    setFailed(false);
    ModelStorageService.getModelData(model.id)
      .then((data) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data.blob);
        setUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(undefined);
    };
  }, [model]);

  const license = model?.license;
  const authors = license?.authors?.length ? license.authors.join(', ') : null;

  return (
    <Dialog open={!!model} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[900px] w-[95vw] h-[85dvh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="truncate">{model?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
          {/* Preview. Keyed on the url so switching models rebuilds the scene rather than reusing the old one. */}
          <div className="flex-1 min-h-0 bg-muted/30">
            {failed ? (
              <div className="h-full flex items-center justify-center p-4">
                <p className="text-sm text-muted-foreground text-center">This model couldn&apos;t be loaded.</p>
              </div>
            ) : url ? (
              <VRMViewer key={url} modelUrl={url} currentHairStyle="" hairLength={0} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading model…</p>
              </div>
            )}
          </div>

          <div className="w-full sm:w-72 shrink-0 border-t sm:border-t-0 sm:border-l overflow-y-auto p-4">
            <Row label="Author">{authors ?? <Unknown />}</Row>
            <Row label="Format">
              {license?.metaVersion === null
                ? 'glTF (no VRM data)'
                : `VRM ${license?.metaVersion === '0' ? '0.0' : '1.0'}`}
            </Row>
            <Row label="Size">{formatBytes(model?.size ?? 0)}</Row>
            <Row label="Licence">
              {license?.licenseName ?? (license?.licenseUrl
                ? <a href={license.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">{license.licenseUrl}</a>
                : <Unknown />)}
            </Row>
            <Row label="Redistribution">
              <Flag value={license?.allowRedistribution} yes="Allowed" no="Not allowed" />
            </Row>
            <Row label="Commercial use">
              {license?.commercialUse ? COMMERCIAL_LABELS[license.commercialUse] : <Unknown />}
            </Row>
            <Row label="Credit">
              <Flag value={license?.creditRequired} yes="Required" no="Not required" />
            </Row>

            {license?.metaVersion === null && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                A plain glTF file carries no licence information, and isn&apos;t guaranteed to pose or morph like a VRM.
              </p>
            )}
            {license?.creditRequired && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                This model&apos;s author asks to be credited wherever it appears.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
