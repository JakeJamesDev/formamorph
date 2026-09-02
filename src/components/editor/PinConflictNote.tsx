import PlaceholderText from '@/components/prompt/PlaceholderText';
import { pinConflict, type PinEditorWorld, type PinRow, type PinSourceKind, type PinSourceRef } from '@/lib/placeholderPins';

const KIND_RULE = 'A stat band outranks a location, a location a trait, and a trait a value pin';
/** The tie-break inside one kind, phrased for the kind being edited. Two locations are never in force
 *  together, so a location never reaches this and has no entry. */
const ORDER_RULE: Partial<Record<PinSourceKind, string>> = {
  trait: 'The lowest in the trait list wins',
  descriptor: 'The lowest stat in the list wins',
  value: 'The lowest in the placeholder list wins',
};
const SELF: Record<PinSourceKind, string> = {
  trait: 'this trait', location: 'this location', descriptor: 'this band', value: 'this value',
};

/**
 * Names every other pin on the same placeholder, from any source, and says which one the precedence rules
 * pick. Silent when nothing else claims it — the common case, where an extra line would just be noise —
 * and where there is no world to read rivals from (a library modal).
 */
export function PinConflictNote({ world, placeholderId, source, onOpenTrait }: {
  world: PinEditorWorld | null;
  placeholderId: string;
  /** The pin's own source, left out of its own rivals. */
  source: PinSourceRef;
  /** Given, a rival trait's name navigates to it. */
  onOpenTrait?: (id: string) => void;
}) {
  const conflict = world && placeholderId ? pinConflict(world, placeholderId, source) : null;
  if (!conflict || !world) return null;
  const { placeholders } = world;
  const name = (row: PinRow) => {
    const text = <PlaceholderText text={row.name} placeholders={placeholders} />;
    switch (row.source.kind) {
      case 'trait': {
        const id = row.source.id;
        return (
          <>the trait {onOpenTrait ? (
            <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => onOpenTrait(id)}>
              {text}
            </button>
          ) : text}</>
        );
      }
      case 'location': return <>the location {text}</>;
      default: return row.label;
    }
  };
  const rule = (conflict.rule === 'order' && ORDER_RULE[source.kind]) || KIND_RULE;
  return (
    <p className="text-meta text-muted-foreground pl-1">
      Also pinned by {conflict.rivals.map((r, i) => (
        <span key={i}>{i > 0 && ', '}{name(r)}</span>
      ))}. {rule}: {conflict.winner ? name(conflict.winner) : SELF[source.kind]}.
    </p>
  );
}

export default PinConflictNote;
