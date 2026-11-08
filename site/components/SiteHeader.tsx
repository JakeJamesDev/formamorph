import { ThemeProvider } from '@/components/theme-provider';
import { SiteAccountControls } from './SiteAccountControls';
import { underPath, useSiteLocation } from '../router';

/** The wordmark's goo filters: the large hero mark rounds more than the small header mark, which stays sharp. */
const GOO_FILTERS = [{ id: 'fm-goo', blur: 2.4 }, { id: 'fm-goo-sm', blur: 0.7 }];

/** One header for the landing, policy, account, and community pages. */
export function SiteHeader() {
  const { pathname } = useSiteLocation();
  const communityActive = underPath(pathname, '/community');
  const feedbackActive = underPath(pathname, '/feedback');
  return (
    <header className="fm-site-header">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        {GOO_FILTERS.map(({ id, blur }) => (
          <filter key={id} id={id}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" result="g" />
            <feComposite in="SourceGraphic" in2="g" operator="atop" />
          </filter>
        ))}
      </svg>
      <div className="fm-header-inner">
        <a className="fm-brand" href="/" aria-label="Formamorph">
          <img src="/site/icon.png" width={32} height={32} alt="" />
          <span className="fm-wordmark" aria-hidden="true">Forma<i><b>m</b><b>o</b><b>r</b><b>p</b><b>h</b></i></span>
        </a>
        <nav className="fm-primary-nav" aria-label="Main navigation">
          <a href="/community" aria-current={communityActive ? 'page' : undefined}>Community</a>
          <a href="/feedback" aria-current={feedbackActive ? 'page' : undefined}>Feedback</a>
        </nav>
        <div className="fm-account"><ThemeProvider><SiteAccountControls signInPath={pathname === '/' || pathname === '/landing/' ? '/login?next=/' : '/login'} /></ThemeProvider></div>
      </div>
    </header>
  );
}
