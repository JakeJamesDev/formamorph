import { SiteLayout } from '../components/SiteLayout';

/** The one page for anything this entry does not serve. */
export function NotFoundPage() {
  return (
    <SiteLayout title="Page Not Found">
      <p className="text-body text-muted-foreground">
        That page is not here. <a className="text-primary hover:underline" href="/">Back to the start</a>.
      </p>
    </SiteLayout>
  );
}
