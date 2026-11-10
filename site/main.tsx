import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { App } from './App';
import { installSiteEmailMarkerStub } from '@/lib/dev/devEmailMarkerStub';
import { watchRenameRefusal } from './renameRefusal';
import './site.css';

// Watches every reply for the rename refusal for the life of the page.
watchRenameRefusal();
// DEV: `/account?fixture=emailMarker-bounce` or `emailMarker-complaint` shows a marked address.
if (import.meta.env.DEV) installSiteEmailMarkerStub();

const root = document.getElementById('root');
if (!root) throw new Error('The site entry found no #root to mount into');

createRoot(root).render(
  <StrictMode>
    {/* The same one the game mounts at its root, so a tip on a profile waits the beat every other tip
        in Formamorph waits. */}
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
