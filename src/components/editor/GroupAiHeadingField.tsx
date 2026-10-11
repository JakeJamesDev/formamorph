import { Checkbox } from '@/components/ui/checkbox';
import { Hint } from '@/components/ui/typography';
import { headingReachesAi } from '@/lib/groupTree';
import { fieldFrame } from '@/lib/historyField';

/** The trait and stat group editors' toggle for whether the AI reads the group's heading. It writes only the
 *  off state, so a group switched back on stores as it did before. */
export function GroupAiHeadingField({ group, members, onChange, disabled = false }: {
  group: { aiVisible?: boolean };
  members: 'traits' | 'stats';
  onChange: (aiVisible: false | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center space-x-2 cursor-pointer" {...fieldFrame('aiVisible')}>
        <Checkbox
          checked={headingReachesAi(group)}
          disabled={disabled}
          onCheckedChange={(c) => onChange(c === true ? undefined : false)}
        />
        <span>Show Heading to AI</span>
      </label>
      <Hint>Sends the name and description. Its {members} always reach the AI.</Hint>
    </div>
  );
}
