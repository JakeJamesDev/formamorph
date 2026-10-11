import { Progress } from '@/components/ui/progress';
import { Meta } from '@/components/ui/typography';
import type { EmbeddingLoadProgress } from '@/lib/embeddingWorkerClient';

const MB = 1048576;

/** The progress bar of the embedding model download, with the megabytes loaded. */
export function ModelDownloadBar({ progress }: { progress: EmbeddingLoadProgress | null }) {
  const known = progress !== null && progress.total > 0;
  return (
    <div className="flex items-center gap-2">
      <Progress className="h-2 flex-1" aria-label="Model Download" value={known ? (progress.loaded / progress.total) * 100 : 0} />
      <Meta className="whitespace-nowrap">
        {known ? `${Math.round(progress.loaded / MB)} / ${Math.round(progress.total / MB)} MB` : 'Preparing…'}
      </Meta>
    </div>
  );
}
