/** Insert-menu contents for `CodeArea`. Kept out of the component file so the constants can be imported
 *  without dragging a component along, and so fast refresh stays whole. */

/** One entry in an insert menu: what it drops in, and which part of it the author should type over. */
export interface InsertSnippet {
  label: string;
  /** Inserted at the caret. */
  text: string;
  /** Substring of `text` left selected afterwards, so the author types straight over the part that varies. */
  select?: string;
}

/** Offsets into an inserted text: the part left selected afterwards. */
export interface InsertSelection {
  from: number;
  to: number;
}

/** Where a snippet's `select` falls in its text, or nothing to select. */
export function snippetSelection(snippet: InsertSnippet): InsertSelection | undefined {
  const from = snippet.select ? snippet.text.indexOf(snippet.select) : -1;
  return from >= 0 ? { from, to: from + snippet.select!.length } : undefined;
}

/** The slot forms a template may declare. Only offered in the template editor — a stat's own code has no
 *  slots to fill, so the menu would only ever generate something the sandbox chokes on. */
export const SLOT_SNIPPETS: InsertSnippet[] = [
  { label: 'Stat picker', text: '{{name:stat}}', select: 'name' },
  { label: 'Number', text: '{{name:number=0}}', select: 'name' },
  { label: 'Daypart picker', text: '{{name:daypart=night}}', select: 'name' },
  { label: 'Choice', text: '{{name:choice(a|b)=a}}', select: 'name' },
  { label: 'Free text', text: '{{name:text}}', select: 'name' },
];
