import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ActionIcon } from '@/lib/actionIcons';
import { ModelDetailsPanel } from './ModelDetailsPanel';
import ModelStorageService from '@/services/ModelStorageService';
import { downloadBlob } from '@/lib/downloadBlob';
import type { ModelMetadata, VrmLicense } from '@/types';

/**
 * The model library's details view: resolves a stored model's bytes, then hands them to the shared
 * `ModelDetailsPanel`. Export lives here rather than in the panel because only a library model has a file to
 * save back out.
 */
export function ModelDetailsModal({ model, onPublish, onClose }: {
  model: ModelMetadata | null;
  /** Publishes this model to Community Creations. Absent for a reader who could not publish anyway. */
  onPublish?: (model: ModelMetadata) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | undefined>();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [license, setLicense] = useState<VrmLicense | undefined>();
  const [failed, setFailed] = useState(false);

  // Hold the model's bytes as an object URL only while the dialog is open; a VRM runs to tens of megabytes.
  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    let objectUrl: string | undefined;
    setFailed(false);
    setLicense(model.license); // shown immediately; replaced below once a stale copy has been re-read
    (async () => {
      try {
        // The library grid only backfills a model that has no thumbnail yet, so a legacy record that already
        // has one can carry a license that predates the Permissive License gate's fields. Forcing the same
        // backfill here, on open, is what actually satisfies "stale record re-read, then kept" for this view.
        await ModelStorageService.ensureThumbnail(model.id);
        const data = await ModelStorageService.getModelData(model.id);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data.blob);
        setUrl(objectUrl);
        setBlob(data.blob);
        setLicense(data.license);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(undefined);
      setBlob(null);
    };
  }, [model]);

  /**
   * Save the model back out byte-for-byte. Nothing is re-encoded: the file that went in is the file that comes
   * out, so its own metadata and license travel with it untouched.
   */
  const handleExport = () => {
    if (!blob || !model) return;
    // A file with no VRM data is a plain glTF; name it for what it is rather than trusting the reported MIME,
    // which browsers often leave empty for .vrm.
    const extension = license?.metaVersion === null ? 'glb' : 'vrm';
    downloadBlob(blob, `${model.name || 'Avatar'}.${extension}`);
  };

  return (
    <ModelDetailsPanel
      open={!!model}
      name={model?.name ?? ''}
      url={url}
      license={license}
      size={model?.size}
      failed={failed}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full" onClick={handleExport} disabled={!blob}>
            <ActionIcon.export className="mr-2 h-4 w-4" /> Export Avatar
          </Button>
          {/* Offered whatever the file's license says. Pressing it on a model that cannot be shared is
              how the player learns which requirement it fails, so the gate runs on the press. */}
          {onPublish && model && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => onPublish(model)}>
              <ActionIcon.publish className="mr-2 h-4 w-4" /> Publish Avatar
            </Button>
          )}
        </div>
      }
    />
  );
}
