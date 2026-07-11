import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { WIKI_CHANGELOG_URL } from '@/services/UpdateService';

// Small pieces shared by the desktop update dialog (UpdateDialog) and the web changelog popout
// (WebVersionChangelog), so the changelog box + "Full changelog" link stay identical in both.

/** The scrollable, de-emphasized release-notes box: renders markdown, or the placeholder when there's none. */
export function ChangelogBody({ text, placeholder }: { text?: string; placeholder: string }) {
  return (
    <div className="changelog-body max-h-[60vh] overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm [&_:first-child]:mt-0">
      {text ? <MarkdownRenderer text={text} /> : <span className="text-muted-foreground">{placeholder}</span>}
    </div>
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
