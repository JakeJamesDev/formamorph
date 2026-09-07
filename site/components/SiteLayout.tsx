import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { clearDeletionCancellation, hasDeletionCancellation } from '@/lib/deletionCancellation';
import { SiteHeader } from './SiteHeader';

interface SiteLayoutProps {
  /** Sits above the panel, in the landing page's heading size. Absent leaves the panel to head itself. */
  title?: string;
  /** One line under the title. */
  subtitle?: string;
  /** A form is read down one column; a profile is a page. */
  width?: 'form' | 'page';
  /** A full-width surface that owns the main area below the shared website header. */
  surface?: boolean;
  children: ReactNode;
}

/** How wide the column runs. A form stays at a comfortable reading measure whatever the window does. */
const WIDTHS = {
  form: 'max-w-[420px]',
  page: 'max-w-[640px]',
} as const;

/** Shared website frame with a content column and footer. */
export function SiteLayout({ title, subtitle, width = 'form', surface = false, children }: SiteLayoutProps) {
  const [deletionCanceled] = useState(hasDeletionCancellation);

  // Cleared after render so React's development double-render cannot consume it before it is visible.
  useEffect(() => {
    if (deletionCanceled) clearDeletionCancellation();
  }, [deletionCanceled]);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />

      <main className={cn(
        'flex w-full flex-1',
        surface ? 'min-h-0 flex-col' : 'mx-auto max-w-[1100px] items-start justify-center px-6 py-12',
      )}>
        <div className={cn('w-full', surface ? 'flex min-h-0 flex-1 flex-col' : WIDTHS[width])}>
          {deletionCanceled && (
            <div role="status" className="mb-6 rounded-lg border border-primary/40 bg-primary/10 p-4 text-label">
              <p className="font-semibold text-foreground">Account deletion canceled</p>
              <p className="mt-1 text-muted-foreground">
                Signing in called it off. Your account and everything in it are still here.
              </p>
            </div>
          )}
          {surface ? children : <>
            {title && <h1 className="text-display font-semibold tracking-tight">{title}</h1>}
            {subtitle && <p className="mt-2 text-body text-muted-foreground">{subtitle}</p>}
            <div className={cn('rounded-xl border border-border bg-card p-6', title && 'mt-6')}>
              {children}
            </div>
          </>}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-8 text-center text-helper text-muted-foreground">
        <a href="/play/" className="hover:text-foreground">Play</a>
        {' · '}
        <a href="/privacy" className="hover:text-foreground">Privacy</a>
        {' · '}
        <a href="https://github.com/JakeJamesDev/formamorph" className="hover:text-foreground">GitHub</a>
        {' · © 2026 Jake James'}
      </footer>
    </div>
  );
}
