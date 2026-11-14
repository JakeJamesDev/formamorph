import type { ReactNode } from 'react';
import { PatreonMark } from '@/components/PatreonMark';
import { isFormamorphAiId } from '@/lib/textEndpointPresets';

/** A text preset's row in a list or picker. Formamorph AI wears the Patreon Mark after the text. */
export function PresetOptionName({ id, children }: { id: string | null | undefined; children: ReactNode }) {
  if (!id || !isFormamorphAiId(id)) return <>{children}</>;
  return (
    <span className="flex items-center gap-2">
      {children}
      <PatreonMark label="Supporter preset" />
    </span>
  );
}
