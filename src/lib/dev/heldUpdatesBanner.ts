/** DEV only: mounts the bar that lists held HMR updates and applies them on request.
 *  Its own React root, outside the app tree and `RootErrorBoundary`, keeps it alive after a crash. */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { HeldUpdatesBar, type HeldState } from './HeldUpdatesBar';

const hot = import.meta.hot;
if (hot) {
  const host = document.createElement('div');
  host.id = 'fm-held-updates';
  document.body.append(host);
  const root = createRoot(host);
  const apply = () => hot.send('fm:apply-held');
  hot.on('fm:held', (state: HeldState) => root.render(createElement(HeldUpdatesBar, { state, apply })));
  hot.dispose(() => {
    root.unmount();
    host.remove();
  });
}
