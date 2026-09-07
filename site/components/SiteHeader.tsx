import { ThemeProvider } from '@/components/theme-provider';
import { SiteAccountControls } from './SiteAccountControls';
import { useSiteLocation } from '../router';

/** One header for the landing, policy, account, and community pages. */
export function SiteHeader() {
  const { pathname } = useSiteLocation();
  const communityActive = pathname === '/community' || pathname.startsWith('/community/');
  return (
    <header className="fm-site-header">
      <div className="fm-header-inner">
        <a className="fm-brand" href="/"><img src="/site/icon.png" width={32} height={32} alt="" /><span>Formamorph</span></a>
        <nav className="fm-primary-nav" aria-label="Main navigation">
          <a href="/community" aria-current={communityActive ? 'page' : undefined}>Community</a>
        </nav>
        <div className="fm-account"><ThemeProvider><SiteAccountControls signInPath={pathname === '/' || pathname === '/landing/' ? '/login?next=/' : '/login'} /></ThemeProvider></div>
      </div>
    </header>
  );
}
