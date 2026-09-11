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

/** The two lookups every template needs. The first needs the map's bracket syntax, which completions
 *  can't write around a name; the second is `self.value`, kept alongside it so the menu teaches both. */
export const STAT_CODE_SNIPPETS: InsertSnippet[] = [
  { label: 'Another stat’s value', text: 'stats["Health"].value', select: 'Health' },
  { label: 'This stat’s value', text: 'self.value' },
];

/** The slot forms a template may declare. Only offered in the template editor — a stat's own code has no
 *  slots to fill, so the menu would only ever generate something the sandbox chokes on. */
export const SLOT_SNIPPETS: InsertSnippet[] = [
  { label: 'Stat picker', text: '{{name:stat}}', select: 'name' },
  { label: 'Number', text: '{{name:number=0}}', select: 'name' },
  { label: 'Daypart picker', text: '{{name:daypart=night}}', select: 'name' },
  { label: 'Choice', text: '{{name:choice(a|b)=a}}', select: 'name' },
  { label: 'Free text', text: '{{name:text}}', select: 'name' },
];
