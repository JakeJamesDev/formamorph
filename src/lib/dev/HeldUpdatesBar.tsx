import type * as React from 'react';
import { Tooltip, TooltipPopup, TooltipPortal, TooltipPositioner, TooltipTrigger } from '@/components/ui/tooltip';

export interface HeldState {
  files: string[];
  reload: boolean;
}

/** Matches the app's tip delay; this root has no provider to carry it. */
const TIP_DELAY_MS = 400;

function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Style files re-inject in place, so applying them never re-mounts a component. */
const isStyle = (path: string) => /\.(css|scss|sass|less|styl|pcss|postcss)$/.test(path);

// An open Radix modal sets pointer-events: none on body and dismisses on an outside press or focus move.
const keepOutOfModals = {
  onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); e.preventDefault(); },
  onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); },
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
};

const barStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 2147483647,
  display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'calc(100vw - 32px)',
  padding: '6px 8px 6px 14px', borderRadius: '0 0 8px 8px', font: '13px system-ui, sans-serif',
  background: 'hsl(var(--card))', color: 'hsl(var(--foreground))',
  borderStyle: 'solid', borderWidth: '0 1px 1px', borderColor: 'hsl(var(--border))',
  boxShadow: '0 2px 8px rgb(0 0 0 / 0.25)', pointerEvents: 'auto',
};

const summaryStyle: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

const buttonStyle: React.CSSProperties = {
  flex: 'none', padding: '3px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', font: 'inherit',
  fontWeight: 600, background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))',
};

/** DEV only: the held-updates bar. The full file paths show in a tip on the summary line. */
export function HeldUpdatesBar({ state, apply }: { state: HeldState; apply: () => void }) {
  const { files, reload } = state;
  if (files.length === 0 && !reload) return null;

  const names = files.map(fileName).join(', ');
  const summary = reload
    ? 'Reload needed to apply the waiting changes'
    : files.every(isStyle)
      ? `Styles changed: ${names}`
      : `Code changed, may reset what's open: ${names}`;

  return (
    <div role="status" style={barStyle} {...keepOutOfModals}>
      {files.length === 0 ? (
        <span style={summaryStyle}>{summary}</span>
      ) : (
        <Tooltip>
          <TooltipTrigger delay={TIP_DELAY_MS} render={<span style={summaryStyle}>{summary}</span>} />
          <TooltipPortal>
            <TooltipPositioner side="bottom">
              <TooltipPopup>{files.join('\n')}</TooltipPopup>
            </TooltipPositioner>
          </TooltipPortal>
        </Tooltip>
      )}
      <button type="button" style={buttonStyle} onClick={reload ? () => window.location.reload() : apply}>
        {reload ? 'Reload' : 'Apply'}
      </button>
    </div>
  );
}
