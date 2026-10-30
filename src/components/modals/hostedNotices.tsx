import { toast } from 'react-toastify';
import { PATREON_PAGE_URL } from '@/components/PatreonSection';
import { hostedSession, type HostedSession } from '@/lib/hostedAi/hostedSession';
import { isSpent, pendingWarning } from '@/lib/hostedAi/hostedAllowance';
import {
  hostedStateCopy, hostedWarningText, HOSTED_SWITCH_BACK_LABEL, HOSTED_UPGRADE_LABEL,
} from '@/lib/hostedAi/hostedCopy';
import type { HostedState } from '@/lib/hostedAi/hostedState';
import { openExternal } from '@/lib/openExternal';

const OPTIONS = { position: 'top-right', autoClose: 12000, closeOnClick: false, pauseOnHover: true, draggable: true } as const;

function NoticeBody({ text, actions }: { text: string; actions: { label: string; run: () => void }[] }) {
  return (
    <div className="flex flex-col items-start gap-1" data-hosted-notice>
      <span>{text}</span>
      <div className="flex gap-3">
        {actions.map((a) => (
          <button key={a.label} type="button" className="text-meta underline" onClick={a.run}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}

const upgrade = { label: HOSTED_UPGRADE_LABEL, run: () => openExternal(PATREON_PAGE_URL) };

/** Toasts the 75% or 90% notice. */
export function showWarningNotice(threshold: number, hosted: HostedState | null): void {
  toast.info(<NoticeBody text={hostedWarningText(threshold, hosted)} actions={[upgrade]} />, { ...OPTIONS, toastId: `hosted-warning-${threshold}` });
}

/** Toasts the end-of-allowance notice with its two actions. */
export function showExhaustedNotice(hosted: HostedState | null, switchBack: () => void): void {
  const reason = hostedStateCopy('exhausted', hosted?.resetAt)?.reason ?? '';
  toast.warn(
    <NoticeBody text={reason} actions={[{ label: HOSTED_SWITCH_BACK_LABEL, run: switchBack }, upgrade]} />,
    { ...OPTIONS, autoClose: false, toastId: 'hosted-exhausted' },
  );
}

/**
 * Raises the allowance notice a committed turn earned: the end-of-allowance one at the cap, else the highest
 * unacknowledged threshold. Runs once per commit, never during a stream, and only for a turn that used
 * Formamorph AI.
 */
export function showHostedNotices(switchBack: () => void, session: HostedSession = hostedSession): void {
  if (!session.takeUsageNoted()) return;
  session.settleTurn();
  const hosted = session.getSnapshot().hosted;
  if (isSpent(hosted)) {
    if (session.claimExhaustedNotice()) showExhaustedNotice(hosted, switchBack);
    return;
  }
  const threshold = pendingWarning(hosted, session.shownWarnings());
  if (threshold === null) return;
  showWarningNotice(threshold, hosted);
  void session.acknowledgeWarning(threshold);
}
