import { useEffect, useMemo, useState } from 'react';
import { useAgeAttested } from '@/contexts/AgeGateContext';
import { useDevRoute } from '@/lib/devRouter';
import AuthService from '@/services/AuthService';
import { contributeAccess, type Contributor } from './correctionContribution';

/** DEV only: the dev route's fixture that shows a signed-in, attested contributor. */
export const DEV_CONTRIBUTE_FIXTURE = 'contribute';

const DEV_CONTRIBUTOR: Contributor = { access: 'ready', accountId: 'dev-contributor' };

const signedInAccount = (): string | null => {
  const id = AuthService.getCurrentUser()?.id;
  return AuthService.isAuthenticated() && id != null ? String(id) : null;
};

/** Who may contribute corrections at this device, kept current across sign-in, sign-out and account switches. */
export function useContributeAccess(): Contributor {
  const attested = useAgeAttested();
  const [accountId, setAccountId] = useState(signedInAccount);
  useEffect(() => AuthService.onSessionChanged(() => setAccountId(signedInAccount())), []);
  const live = useMemo(() => ({ access: contributeAccess(accountId !== null, attested), accountId }), [accountId, attested]);
  const route = useDevRoute();
  return import.meta.env.DEV && route?.fixture === DEV_CONTRIBUTE_FIXTURE ? DEV_CONTRIBUTOR : live;
}
