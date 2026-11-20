import { useEffect, useRef } from 'react';
import { MarkdownPanel } from '@/components/MarkdownPanel';
import { WIKI_CHANGELOG_URL } from '@/services/UpdateService';

// The release-notes box and the "Full changelog" link that What's New shows.

/** Normalize a version to the `v`-prefixed form the heading text uses (`2.2.2` and `v2.2.2` → `v2.2.2`). */
const vtag = (v?: string): string | null => (v ? (v.startsWith('v') ? v : `v${v}`) : null);

/** The scrollable, de-emphasized release-notes box: renders markdown, or the placeholder when there's none.
 *  Tints the installed version's `### <version>` heading by tagging it — see the `.cl-current` rules in CSS. */
export function ChangelogBody({ text, placeholder, currentVersion }: {
  text?: string;
  placeholder: string;
  currentVersion?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cur = vtag(currentVersion);
    // Reset, then walk the flat heading/label sequence: the installed version's heading (`### <tag>`) sets the
    // active tint, which carries onto its following category labels (Added/Fixed) until the next version/minor header.
    root.querySelectorAll('.cl-current').forEach((e) => e.classList.remove('cl-current'));
    let active = false;
    root.querySelectorAll('h2, h3, p').forEach((el) => {
      if (el.tagName === 'H2') { active = false; return; } // minor group header — resets the tint
      if (el.tagName === 'H3') {
        active = Boolean(cur) && el.textContent?.trim() === cur;
        if (active) el.classList.add('cl-current');
        return;
      }
      if (active) el.classList.add('cl-current'); // category label under the tinted version
    });
  }, [text, currentVersion]);

  return <MarkdownPanel ref={ref} text={text} placeholder={placeholder} className="changelog-body max-h-[70dvh]" />;
}

/** Link to the full (verbose) changelog on the wiki, opened in the system browser. */
export function FullChangelogLink() {
  return (
    <a
      href={WIKI_CHANGELOG_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-meta text-muted-foreground hover:text-foreground hover:underline"
    >
      Full changelog →
    </a>
  );
}
