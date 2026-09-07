import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { cancelAgeGateAuthentication } from '@/lib/ageGateAuthentication';
import type { AgeGateAuthenticationFlow } from '@/types';

interface SiteAgeGateAuthenticationValue {
  flow: AgeGateAuthenticationFlow | null;
  continueAuthentication: () => void;
}

const EMPTY_AUTHENTICATION: SiteAgeGateAuthenticationValue = {
  flow: null,
  continueAuthentication: () => {},
};

export const SiteAgeGateAuthenticationContext =
  createContext<SiteAgeGateAuthenticationValue>(EMPTY_AUTHENTICATION);

export const useSiteAgeGateAuthentication = () => useContext(SiteAgeGateAuthenticationContext);

/** Cancel a carried answer when this page is left for anything except its next authentication page. */
export function useAgeGateAuthenticationHandoff(flow: AgeGateAuthenticationFlow | null) {
  const continuing = useRef(false);

  useEffect(() => {
    continuing.current = false;
    const abandon = () => {
      if (!continuing.current && flow) cancelAgeGateAuthentication(flow);
    };
    window.addEventListener('pagehide', abandon);
    return () => window.removeEventListener('pagehide', abandon);
  }, [flow]);

  return useCallback(() => { continuing.current = true; }, []);
}
