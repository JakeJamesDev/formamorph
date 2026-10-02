import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ANY_STATUS, STATUS_OPTIONS, UNRESOLVED_LABELS, UNRESOLVED_STATUS } from "@/lib/feedbackPresentation";
import type { StatusFilter } from "@/lib/feedbackPresentation";
import { cn } from "@/lib/utils";
import type { FeedbackType } from "@/types";

interface FeedbackStatusSelectProps {
  /** Which branch's states to offer. */
  type: FeedbackType;
  value: StatusFilter;
  onValueChange: (value: StatusFilter) => void;
  /** Classes for the trigger, which is `w-40` unless these say otherwise. */
  className?: string;
}

/** The status filter both feedback tabs share: All, the still-open set, then each state. */
export function FeedbackStatusSelect({ type, value, onValueChange, className }: FeedbackStatusSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as StatusFilter)}>
      <SelectTrigger className={cn('w-40', className)} aria-label="Filter by status"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY_STATUS}>All statuses</SelectItem>
        {/* Above the individual states: it is the one most of the work is done from. */}
        <SelectItem value={UNRESOLVED_STATUS}>{UNRESOLVED_LABELS[type]}</SelectItem>
        {STATUS_OPTIONS[type].map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
