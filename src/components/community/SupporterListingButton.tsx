import { useState, useSyncExternalStore } from 'react';
import { Check, Download, Heart, Loader2, LogIn } from 'lucide-react';
import { toast } from 'react-toastify';

import { PATREON_PAGE_URL } from '@/components/PatreonSection';
import { Tip } from '@/components/ui/tooltip';
import { WorldActionButton } from '@/components/WorldActionButton';
import { toastError } from '@/lib/linkToast';
import { useMountedRef } from '@/lib/useMountedRef';
import { supporterContent } from '@/lib/supporterContent';
import { supporterListingAction, type SupporterListingAction } from '@/lib/supporterListingAction';
import type { WorldRecord } from '@/components/WorldDetails';

interface SupporterListingButtonProps {
  world: WorldRecord;
  kind: string;
  signedIn: boolean;
  /** Sends a signed-out reader to sign-in. */
  onSignIn?: (world: WorldRecord) => void;
  /** `card` is the corner icon on a thumbnail; `details` is the full-width button. */
  variant: 'card' | 'details';
}

const LABELS: Record<SupporterListingAction, string> = {
  'sign-in': 'Sign In',
  checking: 'Checking…',
  install: 'Install',
  installed: 'Installed',
  unsupported: 'Not Supported Yet',
  patreon: 'Patreon',
};

const TIPS: Record<SupporterListingAction, string> = {
  'sign-in': 'Sign in to install Supporter content',
  checking: 'Checking your Supporter status',
  install: 'Install this Supporter-only listing',
  installed: "You've installed this",
  unsupported: "You can't install this kind of listing yet",
  patreon: 'Become a Supporter on Patreon to install this',
};

const ICONS = { 'sign-in': LogIn, checking: Loader2, install: Download, installed: Check, unsupported: Download, patreon: Heart } as const;

const subscribe = supporterContent.subscribe;
const getSnapshot = supporterContent.getSnapshot;

/** The one button that replaces Download on a Supporter-only listing. */
export function SupporterListingButton({ world, kind, signedIn, onSignIn, variant }: SupporterListingButtonProps) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const [installing, setInstalling] = useState(false);
  const mounted = useMountedRef();
  const id = String(world._id || world.id);
  const action = supporterListingAction({ signedIn, kind, id, snapshot });
  const inert = action === 'checking' || action === 'installed' || action === 'unsupported' || installing
    || (action === 'sign-in' && !onSignIn);
  const Icon = installing ? Loader2 : ICONS[action];
  const label = installing ? 'Installing…' : LABELS[action];

  const press = async () => {
    if (action === 'sign-in') onSignIn?.(world);
    else if (action === 'patreon') {
      window.open(PATREON_PAGE_URL, '_blank', 'noopener');
      // A stale check may hide a pledge already made; this one lands by the time the player is back.
      void supporterContent.refresh();
    }
    else if (action === 'install') {
      setInstalling(true);
      try {
        await supporterContent.install(id);
        toast.success(`${world.name || 'Listing'} installed`);
      } catch (error) {
        toastError(error, 'Failed to install this');
      } finally {
        if (mounted.current) setInstalling(false);
      }
    }
  };

  if (variant === 'card') {
    return (
      <Tip tip={TIPS[action]}>
        <button
          disabled={inert}
          onClick={(e) => { e.stopPropagation(); void press(); }}
          className="p-1 rounded bg-overlay/50 text-white hover:bg-overlay/70 disabled:opacity-60 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={label}
        >
          <Icon className={installing || action === 'checking' ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
        </button>
      </Tip>
    );
  }

  return (
    <WorldActionButton tone={action === 'patreon' ? 'orangeSoft' : 'sky'} disabled={inert} onClick={() => void press()}>
      <Icon className={installing || action === 'checking' ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} /> {label}
    </WorldActionButton>
  );
}
