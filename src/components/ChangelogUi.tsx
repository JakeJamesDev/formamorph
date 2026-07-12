import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WIKI_CHANGELOG_URL } from '@/services/UpdateService';

// Small pieces shared by the desktop update dialog (UpdateDialog) and the web changelog popout
// (WebVersionChangelog), so the changelog box + "Full changelog" link stay identical in both.

/** The scrollable, de-emphasized release-notes box: renders markdown, or the placeholder when there's none. */
export function ChangelogBody({ text, placeholder }: { text?: string; placeholder: string }) {
  return (
    <ScrollArea className="changelog-body max-h-[60vh] rounded-md border bg-muted/30 text-sm">
      <div className="p-3 [&_:first-child]:mt-0">
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
