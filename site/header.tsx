import { createRoot } from 'react-dom/client';
import { clearDeletionCancellation, hasDeletionCancellation } from '@/lib/deletionCancellation';
import { SiteHeader } from './components/SiteHeader';

const header = document.querySelector('[data-site-header]');
if (header) createRoot(header).render(<SiteHeader />);

const notice = document.querySelector<HTMLElement>('[data-deletion-notice]');
if (notice && hasDeletionCancellation()) {
  notice.hidden = false;
  clearDeletionCancellation();
}
