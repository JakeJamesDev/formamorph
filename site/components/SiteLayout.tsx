import type { ReactNode } from 'react';

interface SiteLayoutProps {
  /** Sits above the panel, in the landing page's heading size. */
  title: string;
  /** One line under the title. */
  subtitle?: string;
  children: ReactNode;
}

/**
 * The frame every account page shares: the landing page's mark on top, its footer underneath, and a
 * narrow card between them. The landing page is one static file with no build step, so its look is
 * matched here rather than imported.
 */
export function SiteLayout({ title, subtitle, children }: SiteLayoutProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-6 py-4">
          <a href="/" className="flex items-center gap-3 no-underline">
            <img src="/site/icon.png" width={32} height={32} alt="" className="rounded-lg" />
            <span className="text-title font-semibold tracking-tight">Formamorph</span>
          </a>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 items-start justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <h1 className="text-display font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-body text-muted-foreground">{subtitle}</p>}
          <div className="mt-6 rounded-xl border border-border bg-card p-6">{children}</div>
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
