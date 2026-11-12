import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Slot = { lead: HTMLElement | null; setLead: (el: HTMLElement | null) => void };

const DetailFooterSlot = createContext<Slot | null>(null);

/** Joins a detail to its frozen footer row, so the open panel can put an action at the row's left. */
export function DetailFooterScope({ children }: { children: ReactNode }) {
  const [lead, setLead] = useState<HTMLElement | null>(null);
  const slot = useMemo(() => ({ lead, setLead }), [lead]);
  return <DetailFooterSlot.Provider value={slot}>{children}</DetailFooterSlot.Provider>;
}

/** Puts `children` at the left of the scope's footer row while mounted. Outside a scope it draws nothing. */
export function DetailFooterLead({ children }: { children: ReactNode }) {
  const lead = useContext(DetailFooterSlot)?.lead;
  return lead ? createPortal(children, lead) : null;
}

/**
 * The frozen footer row below a detail: the panel's lead action on the left, the host's `actions` on the
 * right. Hidden while both sides are empty.
 */
export function DetailFooter({ actions }: { actions?: ReactNode }) {
  const setLead = useContext(DetailFooterSlot)?.setLead;
  return (
    <div data-detail-footer className="flex flex-wrap items-center gap-2 border-t p-3 [&:not(:has(>*>*))]:hidden">
      <div ref={setLead} className="flex items-center gap-2 empty:hidden" />
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2 empty:hidden">{actions}</div>
    </div>
  );
}
