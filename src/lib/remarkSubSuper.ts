/**
 * Remark plugin adding Pandoc-style subscript and superscript: `H~2~O` and `x^2^`.
 *
 * Runs as a tree transformer over `text` nodes rather than a micromark parser extension, which keeps it
 * small and means code spans, code blocks and raw HTML are skipped for free — those parse to their own node
 * types and never reach us. Emits nodes carrying `data.hName`, so they become real `<sub>`/`<sup>` elements
 * without going through raw HTML.
 *
 * Delimited content may not contain whitespace (the Pandoc rule). That is what keeps a lone tilde in ordinary
 * prose — "~5 minutes" — from swallowing the rest of a line looking for its partner. The two forms nest
 * (`~a^b^~`), since each pass recurses into what it captured.
 *
 * Known limit: backslash escapes (`\~`) do not opt out. Remark resolves the escape before a transformer sees
 * the text, so an escaped delimiter is indistinguishable from a real one by this point; opting out needs a
 * parser extension. Write `&#126;` or `<sub>` directly if a literal paired delimiter is needed.
 *
 * Pair this with `singleTilde: false` on remark-gfm — GFM otherwise claims `~x~` for strikethrough and this
 * plugin never sees it. `~~strike~~` is unaffected either way.
 */

/** The mdast subset this walks. Nodes are loose by nature (plugins add their own types), so only the fields
 *  actually read are declared. */
interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
  data?: { hName?: string };
}

// One scan handles both forms. Each alternative forbids whitespace and its own delimiter inside, so a match
// can't run away across a line, and the *other* delimiter stays legal so the forms can nest.
// Non-global: matchAll needs /g, so this is cloned per scan — a shared /g regex carries `lastIndex` across
// the nested calls below and would restart the outer scan forever.
const DELIMITED = /~([^~\s]+)~|\^([^^\s]+)\^/;

/** Split one text value into plain-text and sub/sup nodes. Returns null when there's nothing to convert, so
 *  the caller can leave the original node untouched. */
function splitDelimited(value: string): MdastNode[] | null {
  // Materialize the scan before recursing, so nested calls can't disturb this one's iteration state.
  const matches = [...value.matchAll(new RegExp(DELIMITED, 'g'))];
  if (!matches.length) return null;

  const out: MdastNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.index > cursor) out.push({ type: 'text', value: value.slice(cursor, match.index) });
    const [, sub, sup] = match;
    const inner = sub ?? sup;
    out.push({
      type: sub === undefined ? 'superscript' : 'subscript',
      data: { hName: sub === undefined ? 'sup' : 'sub' },
      // Recurse so the forms nest; inner text with no delimiters just comes back as one text node.
      children: splitDelimited(inner) ?? [{ type: 'text', value: inner }],
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) out.push({ type: 'text', value: value.slice(cursor) });
  return out;
}

/** Replace `text` children in place, depth-first. */
function transform(node: MdastNode): void {
  const children = node.children;
  if (!children) return;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.type === 'text' && child.value !== undefined) {
      const replacement = splitDelimited(child.value);
      if (replacement) {
        children.splice(i, 1, ...replacement);
        i += replacement.length - 1;
      }
    } else {
      transform(child);
    }
  }
}

export function remarkSubSuper() {
  return (tree: MdastNode) => transform(tree);
}
