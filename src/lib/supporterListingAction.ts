import type { DownloadState } from '@/lib/downloadState';
import type { SupporterContentSnapshot } from '@/lib/supporterContent/supporterContent';

/** What the primary button of a Supporter-only listing does. */
export type SupporterListingAction =
  | 'sign-in'
  | 'checking'
  | 'install'
  | 'installed'
  | 'download'
  | 'update'
  | 'redownload'
  | 'unsupported'
  | 'patreon';

/** Whether a listing is Supporter-only. */
export const isSupporterOnly = (listing: { supporter_only?: unknown }): boolean => listing.supporter_only === true;

/** The kinds the Supporter content module has a consumer for. */
const INSTALLABLE_KINDS: readonly string[] = ['mascot', 'world'];

/** The kind that downloads into the world store, so its state is the world store's, not the module's. */
const WORLD_KIND = 'world';

const WORLD_ACTIONS: Record<DownloadState, SupporterListingAction> = {
  none: 'download',
  update: 'update',
  refresh: 'redownload',
};

/**
 * Pick the button for a Supporter-only listing. Sign-in state comes first, then the account's tier.
 *
 * @param input.signedIn - Whether an account is signed in
 * @param input.kind - The listing's kind
 * @param input.id - The listing's id
 * @param input.snapshot - The Supporter content store's current state
 * @param input.downloadState - For a world: what the world store holds of this listing
 */
export function supporterListingAction(input: {
  signedIn: boolean;
  kind: string;
  id: string;
  snapshot: Pick<SupporterContentSnapshot, 'status' | 'qualifies' | 'entitled' | 'installed'>;
  downloadState?: DownloadState;
}): SupporterListingAction {
  const { signedIn, kind, id, snapshot, downloadState = 'none' } = input;
  if (!signedIn) return 'sign-in';
  if (snapshot.status !== 'ready') return 'checking';
  if (!snapshot.qualifies) return 'patreon';
  if (!INSTALLABLE_KINDS.includes(kind)) return 'unsupported';
  const entitled = snapshot.entitled.some((item) => item.id === id);
  if (kind === WORLD_KIND) return entitled ? WORLD_ACTIONS[downloadState] : 'patreon';
  if (snapshot.installed.some((item) => item.id === id)) return 'installed';

  return entitled ? 'install' : 'patreon';
}
