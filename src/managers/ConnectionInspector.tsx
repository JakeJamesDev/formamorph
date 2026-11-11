import { ArrowLeft, ArrowRight, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { ConnectionFields } from '@/components/editor/ConnectionFields';
import type { TravelHintFocus } from '@/components/editor/TravelHintPair';
import { connectionEnds, deleteIntent, updateIntent, type CanvasIntent } from '@/lib/locationCanvas';
import { connectionLegs } from '@/lib/locationGraph';
import type { Connection, LegKey, Placeholder } from '@/types';

/** The selected arrow's Connection panel. Every edit goes back as an intent; Travel reads from the pair's first end. */
export const ConnectionInspector = ({ connection, focus, nameOf, onIntent, onClose, placeholders }: {
  connection: Connection;
  placeholders: Placeholder[];
  /** The leg whose arrow was clicked last. */
  focus: TravelHintFocus | null;
  nameOf: (id: string) => string;
  onIntent: (intent: CanvasIntent, typedLeg?: LegKey) => void;
  onClose: () => void;
}) => {
  const [a, b] = connectionEnds(connection);
  const names = [nameOf(a), nameOf(b)] as const;
  return (
    <div className="space-y-2 rounded-md border bg-card p-3 shadow-md">
      <div className="flex items-center gap-1">
        <Tip tip={`${names[0]} — ${names[1]}`} labelsChild={false}>
          <span className="min-w-0 flex-grow truncate text-label">
            {names[0]} — {names[1]}
          </span>
        </Tip>
        <Tip tip="Delete Connection">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
            onClick={() => onIntent(deleteIntent(connection))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </Tip>
        <Tip tip="Close">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </Tip>
      </div>
      <ConnectionFields
        connection={connection}
        viewpoint={a}
        groupNames={{ travel: `Travel between ${names[0]} and ${names[1]}`, distance: `Distance between ${names[0]} and ${names[1]}` }}
        travelLabels={{
          'two-way': { tip: `Travel both ways between ${names[0]} and ${names[1]}` },
          outgoing: { tip: `Travel one way, ${names[0]} to ${names[1]}` },
          incoming: { tip: `Travel one way, ${names[1]} to ${names[0]}` },
        }}
        legs={connectionLegs(connection).map(({ key }) => {
          const [Icon, destination] = key === 'aToB' ? [ArrowRight, names[1]] : [ArrowLeft, names[0]];
          return {
            key,
            label: (
              <>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 truncate">{destination}</span>
              </>
            ),
            name: `Travel Hint to ${destination}`,
          };
        })}
        idPrefix={`canvas-connection-${connection.id}`}
        placeholders={placeholders}
        onChange={(next, typedLeg) => onIntent(updateIntent(next), typedLeg)}
        focus={focus}
      />
    </div>
  );
};
