import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { ModelDetailsPanel } from './ModelDetailsPanel';
import ModelStorageService from '@/services/ModelStorageService';
import { downloadBlob } from '@/lib/downloadBlob';
import type { ModelMetadata } from '@/types';

/**
 * The model library's details view: resolves a stored model's bytes, then hands them to the shared
 * `ModelDetailsPanel`. Export lives here rather than in the panel because only a library model has a file to
 * save back out.
 */
export function ModelDetailsModal({ model, onClose }: {
  model: ModelMetadata | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | undefined>();
  const [blob, setBlob] = useState<Blob | null>(null);
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
        setBlob(data.blob);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
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
    const extension = model.license?.metaVersion === null ? 'glb' : 'vrm';
    downloadBlob(blob, `${model.name || 'Avatar'}.${extension}`);
  };

  return (
    <ModelDetailsPanel
      open={!!model}
      name={model?.name ?? ''}
      url={url}
      license={model?.license}
      size={model?.size}
      failed={failed}
      onClose={onClose}
      footer={
        <Button variant="outline" size="sm" className="w-full" onClick={handleExport} disabled={!blob}>
          <Download className="mr-2 h-4 w-4" /> Export Avatar
        </Button>
      }
    />
  );
}
