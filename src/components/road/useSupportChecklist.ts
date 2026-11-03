import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PATREON_PAGE_URL } from '@/components/PatreonSection';
import { useAgeGate } from '@/contexts/AgeGateContext';
import { useSettings } from '@/contexts/SettingsContext';
import { isPatreonPageOpened, markPatreonPageOpened } from '@/lib/firstTimeFlowStore';
import { sendFunnelStep } from '@/lib/funnel';
import { openExternal } from '@/lib/openExternal';
import { requestSignIn } from '@/lib/signInStore';
import {
  checklistAction,
  checklistDoneCount,
  checklistRows,
  type ChecklistAction,
  type ChecklistFacts,
  type ChecklistRow,
} from '@/lib/supportChecklist';
import { FORMAMORPH_AI_PRESET_ID, isFormamorphAiId } from '@/lib/textEndpointPresets';
import { useMountedRef } from '@/lib/useMountedRef';
import AuthService from '@/services/AuthService';
import { PatreonService, type PatreonStatus } from '@/services/PatreonService';

/** What the checklist draws and does. */
export interface SupportChecklistModel {
  rows: readonly ChecklistRow[];
  doneCount: number;
  main: { action: ChecklistAction; label: string; busy: boolean; run: () => void };
  /** Link Patreon for a player who pledged earlier, while the main action is another step. */
  linkNow: (() => void) | null;
  /** The Patreon page, while the main action is not already opening it. */
  openPatreon: (() => void) | null;
  notice: string | null;
}

const MAIN_LABELS: Record<ChecklistAction, string> = {
  signIn: 'Sign In',
  openPatreon: 'Open Patreon',
  link: 'Link Patreon',
  switch: 'Switch to Formamorph AI',
  back: 'Done',
};

const subscribeSession = (listener: () => void) => AuthService.onSessionChanged(listener);
const readSignedIn = () => AuthService.isAuthenticated();

/**
 * Reads the checklist's real state and re-reads it on focus, so a player back from Patreon picks up where they
 * left off. Each action runs the existing path. `facts` replaces the live facts (a dev sample).
 */
export function useSupportChecklist({ onDone, facts: given }: { onDone: () => void; facts?: ChecklistFacts }): SupportChecklistModel {
  const mounted = useMountedRef();
  const { attested, requireAttestation } = useAgeGate();
  const { activeTextEndpointPresetId, selectTextEndpointPreset, refreshHostedState } = useSettings();
  const signedIn = useSyncExternalStore(subscribeSession, readSignedIn);
  const [patreon, setPatreon] = useState<PatreonStatus | undefined>(undefined);
  const [patreonOpened, setPatreonOpened] = useState(isPatreonPageOpened);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Counts status reads; only the newest may set the status.
  const latest = useRef(0);

  const read = useCallback(() => {
    if (!signedIn || document.visibilityState === 'hidden') return;
    const mine = ++latest.current;
    PatreonService.getStatus().then(
      (next) => { if (mounted.current && mine === latest.current) setPatreon(next); },
      () => { /* The next focus tries again; the last status stays. */ },
    );
  }, [signedIn, mounted]);

  useEffect(() => {
    read();
    window.addEventListener('focus', read);
    document.addEventListener('visibilitychange', read);
    return () => {
      window.removeEventListener('focus', read);
      document.removeEventListener('visibilitychange', read);
    };
  }, [read]);

  const live: ChecklistFacts = {
    signedIn,
    attested,
    patreon: signedIn ? patreon : undefined,
    patreonOpened,
    onFormamorphAi: isFormamorphAiId(activeTextEndpointPresetId),
  };
  const facts = given ?? live;

  const signIn = () => {
    if (!signedIn) requestSignIn();
    else requireAttestation();
  };
  const openPatreon = () => {
    markPatreonPageOpened();
    sendFunnelStep('patreon_click');
    setPatreonOpened(true);
    openExternal(PATREON_PAGE_URL);
  };
  const link = async () => {
    setNotice(null);
    setBusy(true);
    try {
      const url = await PatreonService.startLink();
      if (mounted.current) openExternal(url);
    } catch (error) {
      if (mounted.current) setNotice(error instanceof Error && error.message ? error.message : 'Could not start the link.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const run: Record<ChecklistAction, () => void> = {
    signIn,
    openPatreon,
    link: () => { void link(); },
    // The hosted state last read before the link, so the switch reads it again for the first send.
    switch: () => {
      selectTextEndpointPreset(FORMAMORPH_AI_PRESET_ID);
      void refreshHostedState();
    },
    back: onDone,
  };

  const finished = given === undefined && checklistRows(facts).every((row) => row.done);
  useEffect(() => {
    if (finished) sendFunnelStep('checklist_finished');
  }, [finished]);

  const action = checklistAction(facts);
  const reachable = facts.signedIn && facts.attested;
  return {
    rows: checklistRows(facts),
    doneCount: checklistDoneCount(facts),
    main: { action, label: MAIN_LABELS[action], busy, run: run[action] },
    linkNow: reachable && action !== 'link' && facts.patreon?.linked !== true ? run.link : null,
    openPatreon: reachable && action !== 'openPatreon' && facts.patreon?.linked !== true ? run.openPatreon : null,
    notice,
  };
}
