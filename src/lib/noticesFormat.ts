/** One `###` entry of THIRD-PARTY-NOTICES.md. */
export interface NoticeEntry {
  name: string;
  section: string;
  text: string;
}

export const SUMMARY_SECTION = 'Software license summary';
export const PACKAGES_SECTION = 'Components and license texts';

const FENCE = /^\s*(`{3,})/;

/** The fence still open after `line`, given the one open before it. */
function fenceAfter(line: string, open: string): string {
  const fence = FENCE.exec(line)?.[1];
  if (!open) return fence ?? '';
  return fence && fence.length >= open.length && line.trim() === fence ? '' : open;
}

/** The file's `###` entries in order. Headings inside a fenced license text are that text, not entries. */
export function parseNotices(markdown: string): NoticeEntry[] {
  const entries: NoticeEntry[] = [];
  let section = '';
  let body: string[] | null = null;
  let name = '';
  let open = '';
  const close = () => {
    if (body) entries.push({ name, section, text: body.join('\n').trim() });
    body = null;
  };
  for (const line of markdown.split(/\r?\n/)) {
    const inFence = open !== '';
    open = fenceAfter(line, open);
    if (!inFence && !open && line.startsWith('## ')) {
      close();
      section = line.slice(3).trim();
    } else if (!inFence && !open && line.startsWith('### ')) {
      close();
      name = line.slice(4).trim();
      body = [];
    } else {
      body?.push(line);
    }
  }
  close();
  return entries;
}

/** True when the entry's text holds a fenced block with something in it. */
export function hasLicenseText(text: string): boolean {
  let open = '';
  for (const line of text.split('\n')) {
    const next = fenceAfter(line, open);
    if (open && next && line.trim()) return true;
    open = next;
  }
  return false;
}
