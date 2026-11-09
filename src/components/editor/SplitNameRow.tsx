import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { HelpButton } from '@/components/HelpButton';
import { fieldFrame } from '@/lib/historyField';

/** One name field's label line. The fixed height keeps both inputs on one line when only one label has a help button. */
const SplitNameLabel =({ children, helpTopicId }: { children: ReactNode; helpTopicId?: string }) => (
  <div className="flex min-h-6 items-center gap-2">
    <Label>{children}</Label>
    {helpTopicId && <HelpButton topicId={helpTopicId} className="h-6 w-6" />}
  </div>
);

/** A name field and the partner that replaces it, with the partner's own label and help button. */
export const SplitNameField = ({ historyField, label, helpTopicId, tourAnchor, children }: {
  /** History key of the field, for search and Reveal Origin. */
  historyField: string;
  label: string;
  helpTopicId?: string;
  tourAnchor?: string;
  children: ReactNode;
}) => (
  <div className="min-w-0 space-y-2" data-tour-anchor={tourAnchor} {...fieldFrame(historyField)}>
    <SplitNameLabel helpTopicId={helpTopicId}>{label}</SplitNameLabel>
    {children}
  </div>
);

/**
 * Name beside its partner name. The two split when their column has room and stack below that,
 * measured on the row itself so a narrow pane stacks them. With no partner, Name takes the full width.
 */
export const SplitNameRow = ({ name, partner }: { name: ReactNode; partner?: ReactNode }) => (
  <div className="[container-type:inline-size]">
    <div className="grid gap-4 [@container(min-width:32rem)]:grid-cols-2">
      {name}
      {partner}
    </div>
  </div>
);
