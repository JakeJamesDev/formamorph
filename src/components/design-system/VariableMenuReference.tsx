import { useState } from 'react';
import { Hint } from '@/components/ui/typography';
import { VariableMenu } from '@/components/prompt/VariableMenu';
import { scriptSurface, WORLD_SCRIPT_SURFACE } from '@/lib/statCodeSurface';
import { buildVariableTree, timingGlobalsOf } from '@/lib/statCodeVariableTree';

/** A world script's Variable menu with no world, so every name list is one type-over row. */
const build = () => buildVariableTree(undefined, null, 'empty', timingGlobalsOf(scriptSurface(WORLD_SCRIPT_SURFACE, 'before')));

/** The code editor's Variable menu on the production tree: type, access mark and method rows. */
export function VariableMenuReference() {
  const [status, setStatus] = useState('The sample has inserted nothing.');
  return (
    <section aria-label="Variable Menu Rows" className="space-y-2 rounded-lg border bg-background p-4">
      <VariableMenu build={build} onPick={(field) => setStatus(`The sample would insert ${field.insert}.`)} />
      <Hint role="status">{status}</Hint>
    </section>
  );
}
