import { useEffect } from 'react';
import { AccountPage } from './pages/AccountPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OwnProfilePage } from './pages/OwnProfilePage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { profileUsername, useSiteLocation } from './router';

/** Every fixed path this entry serves, and the tab title that goes with it. */
const ROUTES = {
  '/login': { title: 'Sign In · Formamorph', page: LoginPage },
  '/register': { title: 'Create Account · Formamorph', page: RegisterPage },
  '/profile': { title: 'Your Profile · Formamorph', page: OwnProfilePage },
  '/account': { title: 'Your Account · Formamorph', page: AccountPage },
  '/verify-email': { title: 'Verify Email · Formamorph', page: VerifyEmailPage },
} as const;

/** A trailing slash is the same route. Live, the hosting rules redirect it away before the page loads;
 *  the dev server serves it straight through, so the entry has to read it as the same path. */
const normalize = (pathname: string) =>
  pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

export function App() {
  const { pathname } = useSiteLocation();
  const path = normalize(pathname);

  const fixed = ROUTES[path as keyof typeof ROUTES];
  const username = fixed ? null : profileUsername(path);

  // The document is one file for every route, so its title is set here rather than in the markup. A
  // profile is the exception: it names an account that may turn out not to exist, so it titles itself
  // once the server has answered and this leaves it the plain name until then.
  useEffect(() => {
    document.title = fixed?.title ?? 'Formamorph';
  }, [fixed]);

  if (fixed) {
    const Page = fixed.page;
    return <Page />;
  }
  if (username) return <ProfilePage username={username} />;

  return <NotFoundPage />;
}
