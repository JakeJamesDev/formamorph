import { useEffect, useRef } from 'react';
import { MarkdownPanel } from '@/components/MarkdownPanel';
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
    // Reset, then walk the flat heading/label sequence: a tinted version heading (`### <tag>`) sets the active
    // tint, which carries onto its following category labels (Added/Fixed) until the next version/minor header.
    root.querySelectorAll('.cl-current, .cl-update').forEach((e) => e.classList.remove('cl-current', 'cl-update'));
    let active: 'cl-current' | 'cl-update' | null = null;
    root.querySelectorAll('h2, h3, p').forEach((el) => {
      if (el.tagName === 'H2') { active = null; return; } // minor group header — resets the tint
      if (el.tagName === 'H3') {
        const t = el.textContent?.trim();
        active = cur && t === cur ? 'cl-current' : upd && upd !== cur && t === upd ? 'cl-update' : null;
        if (active) el.classList.add(active);
        return;
      }
      if (active) el.classList.add(active); // category label under a tinted version
    });
  }, [text, currentVersion, updateVersion]);

  return <MarkdownPanel ref={ref} text={text} placeholder={placeholder} className="changelog-body max-h-[60dvh]" />;
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
