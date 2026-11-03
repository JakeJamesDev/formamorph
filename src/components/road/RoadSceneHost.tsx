import { useEffect, useState, useSyncExternalStore } from 'react';
import { useDevRoute } from '@/lib/devRouter';
import type { ChecklistFacts } from '@/lib/supportChecklist';
import { SUPPORTER_TIERS } from '@/lib/supporterFlair';
import { RoadScene } from './RoadScene';
import { closeRoadScene, isRoadSceneOpen, roadSceneStart, subscribeRoadScene, type RoadSceneView } from './roadSceneStore';
import { useSupportChecklist } from './useSupportChecklist';

const SIGNED_IN: ChecklistFacts = { signedIn: true, attested: true, patreon: undefined, patreonOpened: false, onFormamorphAi: false };

/** DEV: `#dev?modal=road&tab=checklist&subtab=<name>` draws the checklist on a canned state. */
const DEV_CHECKLIST_SAMPLES: Record<string, ChecklistFacts> = !import.meta.env.DEV ? {} : {
  start: { ...SIGNED_IN, signedIn: false },
  signedIn: SIGNED_IN,
  visited: { ...SIGNED_IN, patreonOpened: true },
  noPledge: { ...SIGNED_IN, patreonOpened: true, patreon: { linked: true, tier: null, since: null, showFlair: true } },
  linked: { ...SIGNED_IN, patreonOpened: true, patreon: { linked: true, tier: 'supporter', since: null, showFlair: true } },
  finished: { ...SIGNED_IN, patreonOpened: true, patreon: { linked: true, tier: 'supporter', since: null, showFlair: true }, onFormamorphAi: true },
};

/** Outlasts the scene's fade, so it leaves the page once the fade ends. */
const EXIT_MS = 250;

function OpenScene({ open, initialView, devTier, devFacts, onClose }: {
  open: boolean;
  initialView: RoadSceneView;
  devTier?: (typeof SUPPORTER_TIERS)[number];
  devFacts?: ChecklistFacts;
  onClose: () => void;
}) {
  const checklist = useSupportChecklist({ onDone: onClose, facts: devFacts });
  return <RoadScene open={open} initialTier={devTier} initialView={initialView} checklist={checklist} onKeepPlaying={onClose} />;
}

/** The one scene for every view. It sits above the view switch, so a view change never closes it. */
export function RoadSceneHost() {
  const requested = useSyncExternalStore(subscribeRoadScene, isRoadSceneOpen);
  const devRoute = useDevRoute();
  // DEV: `#dev?modal=road&tab=<tier>` opens the scene on a level; `tab=checklist` opens the checklist.
  const devOpen = import.meta.env.DEV && devRoute?.modal === 'road';
  const open = requested || devOpen;
  const [mounted, setMounted] = useState(open);
  // Each opening is a new scene, even one that interrupts the last one's fade.
  const [opening, setOpening] = useState({ open, count: 0 });
  if (open !== opening.open) setOpening({ open, count: opening.count + (open ? 1 : 0) });
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);
  if (!mounted) return null;
  const devChecklist = devOpen && devRoute?.tab === 'checklist';
  const onClose = () => {
    closeRoadScene();
    if (devOpen) window.location.hash = '#dev';
  };
  return (
    <OpenScene
      key={opening.count}
      open={open}
      initialView={devOpen ? (devChecklist ? 'checklist' : 'levels') : roadSceneStart()}
      devTier={devOpen ? SUPPORTER_TIERS.find((tier) => tier === devRoute?.tab) : undefined}
      devFacts={devChecklist ? DEV_CHECKLIST_SAMPLES[devRoute?.subtab ?? ''] : undefined}
      onClose={onClose}
    />
  );
}
