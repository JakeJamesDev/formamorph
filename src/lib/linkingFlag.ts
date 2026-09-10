/**
 * Whether the World Editor offers library links.
 *
 * Off ships the local library on its own: Save to Library, Add from Library and Import file all work, no
 * world copy follows a source, and nothing writes a `link` record. The linking machinery underneath
 * (`linkedContent`, `librarySources`, `contentLink`) stays live and stays tested.
 *
 * PARKED — the linked-world-content effort resumes at ticket 03. Delete this module and every guard that
 * reads it then; `docs-internal/specs/linked-world-content/issues/03-connect-world-references.md` lists
 * the guards.
 *
 * Its own module so a test can turn linking on with `vi.mock('@/lib/linkingFlag', ...)`.
 */
export const LINKING_ENABLED = false;
