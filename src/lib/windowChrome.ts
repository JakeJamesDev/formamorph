/** The theme's foreground as the `#rrggbb` the native window buttons take. */
function themeForeground(root: HTMLElement): string {
  const probe = document.createElement('span');
  probe.style.color = `hsl(${getComputedStyle(root).getPropertyValue('--foreground').trim()})`;
  document.body.append(probe);
  const [r = 255, g = 255, b = 255] = (getComputedStyle(probe).color.match(/\d+/g) ?? []).map(Number);
  probe.remove();
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

/** Sets the desktop flag and starts the window's drag area and symbol color. Only the Windows desktop build sets it. */
export function installWindowChrome(): void {
  const bridge = window.formamorphDesktop;
  if (!bridge?.windowOverlay) return;

  const root = document.documentElement;
  root.dataset.windowOverlay = '';

  const dragArea = document.createElement('div');
  dragArea.className = 'window-drag-area';
  document.body.prepend(dragArea);

  let sent = '';
  const syncSymbolColor = () => {
    const color = themeForeground(root);
    if (color === sent) return;
    sent = color;
    void bridge.setWindowSymbolColor?.(color);
  };
  syncSymbolColor();
  new MutationObserver(syncSymbolColor).observe(root, { attributes: true, attributeFilter: ['class'] });
}
