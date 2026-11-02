import { SUPPORTERS_THANKS, SupportersWall } from '@/components/SupportersWall';
import { usernameProfilePath } from '@/lib/usernameRule';
import { SiteLayout } from '../components/SiteLayout';

/** The Supporters wall at `formamorph.ai/supporters`. Open to anyone; a name links to its profile page. */
export function SupportersPage() {
  return (
    <SiteLayout title="Supporters" subtitle={SUPPORTERS_THANKS} width="page">
      <SupportersWall
        renderName={(supporter, className) => (
          <a href={usernameProfilePath(supporter.username)} className={className}>{supporter.username}</a>
        )}
      />
    </SiteLayout>
  );
}
