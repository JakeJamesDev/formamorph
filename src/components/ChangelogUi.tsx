import { useEffect, useRef } from 'react';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WIKI_CHANGELOG_URL } from '@/services/UpdateService';

// Small pieces shared by the desktop update dialog (UpdateDialog) and the web changelog popout
// (WebVersionChangelog), so the changelog box + "Full changelog" link stay identical in both.

/** Normalize a version to the `v`-prefixed form the heading text uses (`2.2.2` and `v2.2.2` → `v2.2.2`). */
const vtag = (v?: string): string | null => (v ? (v.startsWith('v') ? v : `v${v}`) : null);

/** The scrollable, de-emphasized release-notes box: renders markdown, or the placeholder when there's none.
 *  When given the current/update versions, tints their `### <version>` headings (info = current, success =
 *  newest uninstalled) by tagging the matching heading — see the `.cl-current`/`.cl-update` rules in CSS. */
export function ChangelogBody({ text, placeholder, currentVersion, updateVersion }: {
  text?: string;
  placeholder: string;
  currentVersion?: string;
  updateVersion?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cur = vtag(currentVersion);
    const upd = vtag(updateVersion);
    root.querySelectorAll('h3').forEach((h) => {
      const t = h.textContent?.trim();
      h.classList.toggle('cl-current', !!cur && t === cur);
      h.classList.toggle('cl-update', !!upd && upd !== cur && t === upd);
    });
  }, [text, currentVersion, updateVersion]);

  return (
    <ScrollArea className="changelog-body max-h-[60vh] rounded-md border bg-muted/30 text-sm">
      <div ref={ref} className="p-3 [&_:first-child]:mt-0">
        {text ? <MarkdownRenderer text={text} /> : <span className="text-muted-foreground">{placeholder}</span>}
      </div>
    </ScrollArea>
  );
}

/** Link to the full (verbose) changelog on the wiki, opened in the system browser. */
export function FullChangelogLink() {
  return (
    <a
      href={WIKI_CHANGELOG_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
    >
      Full changelog →
    </a>
  );
}
