import { CircleUserRound } from 'lucide-react';
import { Hint } from '@/components/ui/typography';
import { CUSTOM_PERSONA_NAME } from '@/lib/traitTree';

/** What selecting the Custom Persona node opens: its name and when its links apply. */
export function CustomPersonaPanel() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-label font-medium">
        <CircleUserRound className="h-4 w-4 shrink-0" aria-hidden />
        {CUSTOM_PERSONA_NAME}
      </div>
      <Hint>Gives you its linked traits when you have no world persona</Hint>
    </div>
  );
}
