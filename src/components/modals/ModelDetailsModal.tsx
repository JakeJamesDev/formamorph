import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ActionIcon } from '@/lib/actionIcons';
import { ModelDetailsPanel } from './ModelDetailsPanel';
import ModelStorageService from '@/services/ModelStorageService';
import { downloadBlob } from '@/lib/downloadBlob';
import { libraryFileName } from '@/lib/libraryVrm';
import { useHeldModelBlob } from '@/lib/useHeldModelBlob';
import type { ModelMetadata } from '@/types';

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
  const load = useMemo(() => model && (async () => {
    // The library grid only backfills a model that has no thumbnail yet, so a legacy record that already has
    // one can carry a license that predates the Permissive License gate's fields. Opening re-reads it.
    await ModelStorageService.ensureThumbnail(model.id);
    const data = await ModelStorageService.getModelData(model.id);
    return { blob: data.blob, license: data.license };
  }), [model]);
  const { url, blob, license: readLicense, failed } = useHeldModelBlob(load);
  // The stored license shows at once; the re-read one replaces it.
  const license = readLicense ?? model?.license;

  /** Saves the model back out byte-for-byte, so its own metadata and license travel with it untouched. */
  const handleExport = () => {
    if (!blob || !model) return;
    downloadBlob(blob, libraryFileName(model.name || 'Avatar', license));
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleExport} disabled={!blob}>
            <ActionIcon.export className="mr-2 h-4 w-4" /> Export
          </Button>
          {/* Offered whatever the file's license says. Pressing it on a model that cannot be shared is
              how the player learns which requirement it fails, so the gate runs on the press. */}
          {onPublish && model && (
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onPublish(model)}>
              <ActionIcon.publish className="mr-2 h-4 w-4" /> Publish
            </Button>
          )}
        </div>
      }
    />
  );
}
