import { useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';
import { useSiteLocation } from './router';

/** Every path this entry serves, and the tab title that goes with it. */
const ROUTES = {
  '/login': { title: 'Sign In · Formamorph', page: LoginPage },
  '/register': { title: 'Create Account · Formamorph', page: RegisterPage },
} as const;

/** A trailing slash is the same route. Live, the hosting rules redirect it away before the page loads;
 *  the dev server serves it straight through, so the entry has to read it as the same path. */
const normalize = (pathname: string) =>
  pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

export function App() {
  const { pathname } = useSiteLocation();
  const route = ROUTES[normalize(pathname) as keyof typeof ROUTES];

  // The document is one file for every route, so its title is set here rather than in the markup.
  useEffect(() => {
    document.title = route?.title ?? 'Formamorph';
  }, [route]);

  const Page = route?.page ?? NotFoundPage;
  return <Page />;
}
