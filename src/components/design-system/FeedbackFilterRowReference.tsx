import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/typography';
import { StaffFilterRow, UserFilterRow } from '@/components/menu/FeedbackFilterRow';
import { useFeedbackFilters } from '@/components/menu/useFeedbackFilters';
import { STAFF_HIDDEN_FILTERS, USER_HIDDEN_FILTERS, staffFilterDefaults, userFilterDefaults } from '@/lib/feedbackPresentation';

const noop = () => {};

function StaffSample() {
  const filters = useFeedbackFilters(staffFilterDefaults('suggestion'), STAFF_HIDDEN_FILTERS, noop);
  return (
    <section aria-label="Staff Queue" className="min-w-0 space-y-2 rounded-md border p-3">
      <SectionTitle>Staff Queue</SectionTitle>
      <StaffFilterRow type="suggestion" filters={filters} />
    </section>
  );
}

function UserSample() {
  const filters = useFeedbackFilters(userFilterDefaults('bug'), USER_HIDDEN_FILTERS, noop);
  return (
    <section aria-label="User Tab" className="min-w-0 space-y-2 rounded-md border p-3">
      <SectionTitle>User Tab</SectionTitle>
      <UserFilterRow type="bug" filters={filters} fileLabel="Report a Bug" onFile={noop} />
    </section>
  );
}

/** The feedback filter row for both viewers, in local state. */
export function FeedbackFilterRowReference() {
  return (
    <Card role="region" aria-labelledby="feedback-filter-row-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="feedback-filter-row-reference-title" className="text-heading">Feedback Filter Row Reference</CardTitle>
        <CardDescription>Change a filter under “Filters” to show the badge, then select “Reset Filters”.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3">
        <StaffSample />
        <UserSample />
      </CardContent>
    </Card>
  );
}
