import { useState } from 'react';
import { useMountedRef } from '@/lib/useMountedRef';
import { RecheckButton } from './EndpointReachabilityBadge';
import { CAPABILITY_RECHECK } from './settingsCopy';

/** The model a muted capability row's answer describes, and Recheck. A null `model` shows no name. */
export function CapabilityRecheck({ model, onRecheck }: {
  model: string | null;
  onRecheck: () => Promise<void>;
}) {
  const [checking, setChecking] = useState(false);
  const mounted = useMountedRef();
  const recheck = () => {
    setChecking(true);
    void onRecheck().catch(() => undefined).finally(() => { if (mounted.current) setChecking(false); });
  };
  return (
    <div className="mt-1 flex min-w-0 items-center gap-2 text-meta">
      {model && <span className="min-w-0 truncate text-muted-foreground">{CAPABILITY_RECHECK.checkedFor(model)}</span>}
      <RecheckButton onClick={recheck} disabled={checking}>
        {checking ? CAPABILITY_RECHECK.checking : CAPABILITY_RECHECK.recheck}
      </RecheckButton>
    </div>
  );
}
