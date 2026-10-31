import { createContext, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { noteEntityAdded } from '@/lib/formaquestion/entityAdds';
import { ENTITY_BLOCK_LANGUAGE, readEntityBlock, type EntityDraft } from '@/lib/formaquestion/entityBlock';
import { useHelpWorld } from '@/lib/formaquestion/helpWorld';
import { entityNamesOf } from '@/lib/formaquestion/worldIndex';
import { CopyButton, type SnippetBlock, type SnippetCard } from './CodeSnippet';

const NO_EDITOR_TIP = 'Open the World Editor to add this entity';

/** The text of the entity fence the answer is still writing, or null: that fence shows as a card while it arrives. */
export const OpenEntityFence = createContext<string | null>(null);

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const duplicateTip = (name: string) => `Your world already has an entity named ${name.trim()}`;

/** Add: writes the draft into the open World Editor's world. A duplicate name keeps it on, with the warning as its tip. */
function AddButton({ draft, duplicate, onAdded }: { draft: EntityDraft | null; duplicate: boolean; onAdded: () => void }) {
  const world = useHelpWorld();
  const add = world?.addEntity;
  if (!add || !draft) {
    const button = (
      <Button variant="outline" size="xs" aria-disabled className="cursor-not-allowed gap-1 opacity-50">
        <Plus aria-hidden className="h-3.5 w-3.5" />
        Add
      </Button>
    );
    return draft ? <Tip tip={NO_EDITOR_TIP} labelsChild={false}>{button}</Tip> : button;
  }
  return (
    <Tip tip={duplicate ? duplicateTip(draft.name) : null} labelsChild={false}>
      <Button
        variant="outline"
        size="xs"
        className="gap-1"
        onClick={() => {
          add(draft);
          noteEntityAdded(draft.name);
          onAdded();
        }}
      >
        <Plus aria-hidden className="h-3.5 w-3.5" />
        Add
      </Button>
    </Tip>
  );
}

/** The warning beside a name the open world already has. */
function DuplicateMark({ name }: { name: string }) {
  const tip = duplicateTip(name);
  return (
    <Tip tip={tip}>
      <span role="img" aria-label={tip} tabIndex={0} className="inline-flex shrink-0 rounded-sm text-warning">
        <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
      </span>
    </Tip>
  );
}

/** One entity block as a read-only card: the name, the AI description, Copy and Add. */
export function EntityCard({ code, draft, partial }: { code: string; draft: EntityDraft | null; partial: Partial<EntityDraft> }) {
  const world = useHelpWorld();
  // Editor edits reach no help render, so an Add renders the card again to read the name it added.
  const [, setAdds] = useState(0);
  const name = draft?.name ?? partial.name ?? '';
  const aiDescription = draft?.aiDescription ?? partial.aiDescription ?? '';
  const duplicate = draft !== null && world?.world !== undefined && entityNamesOf(world.world()).some((taken) => sameName(taken, draft.name));
  return (
    <div role="group" aria-label={name ? `Entity: ${name}` : 'Entity'} data-entity-card className="my-4 flex flex-col gap-1.5 rounded-md border bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <Meta className="shrink-0">Entity</Meta>
        <span className="min-w-0 truncate font-medium">{name}</span>
        {duplicate && <DuplicateMark name={name} />}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <CopyButton code={code} />
          <AddButton draft={draft} duplicate={duplicate} onAdded={() => setAdds((count) => count + 1)} />
        </div>
      </div>
      {aiDescription && <p className="whitespace-pre-wrap text-label text-muted-foreground">{aiDescription}</p>}
    </div>
  );
}

/** An `entity` block: a card when it reads, or while it arrives; its plain code view otherwise. */
function EntitySnippet({ block, codeView }: { block: SnippetBlock; codeView: ReactNode }) {
  const open = useContext(OpenEntityFence);
  const read = readEntityBlock(block.code);
  // A fence still arriving offers no Add: its last line may be cut off.
  if (open !== null && open === block.code) return <EntityCard code={block.code} draft={null} partial={read.ok ? read.draft : read.partial} />;
  return read.ok ? <EntityCard code={block.code} draft={read.draft} partial={read.draft} /> : codeView;
}

/** The answer's card for `entity` fences. */
export const entityCard: SnippetCard = (block, codeView) =>
  block.language.toLowerCase() === ENTITY_BLOCK_LANGUAGE ? <EntitySnippet block={block} codeView={codeView} /> : undefined;
