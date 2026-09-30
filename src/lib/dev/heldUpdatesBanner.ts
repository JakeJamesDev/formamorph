/** DEV only: a bar that lists the HMR updates the dev server is holding and applies them on request.
 *  Plain DOM outside React, so it works while the page runs code older than the source. */

interface HeldState {
  files: string[];
  reload: boolean;
}

const BAR_ID = 'fm-held-updates';

function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Style files re-inject in place, so applying them never re-mounts a component. */
const isStyle = (path: string) => /\.(css|scss|sass|less|styl|pcss|postcss)$/.test(path);

function render(state: HeldState, apply: () => void): void {
  document.getElementById(BAR_ID)?.remove();
  if (state.files.length === 0 && !state.reload) return;

  const bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.setAttribute('role', 'status');
  Object.assign(bar.style, {
    position: 'fixed', top: '0', left: '50%', transform: 'translateX(-50%)', zIndex: '2147483647',
    display: 'flex', alignItems: 'center', gap: '12px', maxWidth: 'calc(100vw - 32px)',
    padding: '6px 8px 6px 14px', borderRadius: '0 0 8px 8px', font: '13px system-ui, sans-serif',
    background: 'hsl(var(--card))', color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--border))', borderTop: 'none', boxShadow: '0 2px 8px rgb(0 0 0 / 0.25)',
  });

  const names = state.files.map(fileName).join(', ');
  const text = document.createElement('span');
  text.textContent = state.reload
    ? 'Reload needed to apply the waiting changes'
    : state.files.every(isStyle)
      ? `Styles changed: ${names}`
      : `Code changed, may reset what's open: ${names}`;
  text.title = state.files.join('\n');
  Object.assign(text.style, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = state.reload ? 'Reload' : 'Apply';
  Object.assign(button.style, {
    flex: 'none', padding: '3px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', font: 'inherit',
    fontWeight: '600', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))',
  });
  button.addEventListener('click', state.reload ? () => window.location.reload() : apply);

  // An open Radix modal sets pointer-events: none on body and dismisses on an outside press or focus move.
  bar.style.pointerEvents = 'auto';
  for (const type of ['pointerdown', 'mousedown', 'touchstart'] as const) {
    bar.addEventListener(type, (e) => {
      e.stopPropagation();
      if (type !== 'touchstart') e.preventDefault();
    });
  }

  bar.append(text, button);
  document.body.append(bar);
}

const hot = import.meta.hot;
if (hot) {
  const apply = () => hot.send('fm:apply-held');
  hot.on('fm:held', (state: HeldState) => render(state, apply));
}
