/** The Locations tab's two views of one world: the tree that edits a location's fields, and the canvas that
 *  shows how the world connects. Exported as data so the view switch and the dev-router agree on the pair. */
export const LOCATION_VIEWS = [
  { value: 'list', label: 'List' },
  { value: 'canvas', label: 'Canvas' },
] as const;

export type LocationView = (typeof LOCATION_VIEWS)[number]['value'];
