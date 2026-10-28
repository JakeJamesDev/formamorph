import type { ReactNode } from "react";

/** The listings that await review, pinned above the normal results for staff. */
export function PinnedReviewGroup({ gridClassName, children }: { gridClassName: string; children: ReactNode }) {
  return (
    <section aria-labelledby="pinned-review-heading" className="border-b">
      <h3 id="pinned-review-heading" className="px-6 pt-4 text-label font-medium text-muted-foreground">
        Awaiting Review
      </h3>
      <div className={gridClassName}>{children}</div>
    </section>
  );
}
