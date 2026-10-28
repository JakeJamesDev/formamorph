import type { SupporterContentSnapshot } from '@/lib/supporterContent/supporterContent';

/** What the primary button of a Supporter-only listing does. */
export type SupporterListingAction =
  | 'sign-in'
  | 'checking'
  | 'install'
  | 'installed'
  | 'unsupported'
  | 'patreon';

/** Whether a listing is Supporter-only. */
export const isSupporterOnly = (listing: { supporter_only?: unknown }): boolean => listing.supporter_only === true;

/** The kinds the Supporter content module has a consumer for. */
const INSTALLABLE_KINDS: readonly string[] = ['mascot'];

/**
 * Pick the button for a Supporter-only listing. Sign-in state comes first, then the account's tier.
 *
 * @param input.signedIn - Whether an account is signed in
 * @param input.kind - The listing's kind
 * @param input.id - The listing's id
 * @param input.snapshot - The Supporter content store's current state
 */
export function supporterListingAction(input: {
  signedIn: boolean;
  kind: string;
  id: string;
  snapshot: Pick<SupporterContentSnapshot, 'status' | 'qualifies' | 'entitled' | 'installed'>;
}): SupporterListingAction {
  const { signedIn, kind, id, snapshot } = input;
  if (!signedIn) return 'sign-in';
  if (snapshot.status !== 'ready') return 'checking';
  if (!snapshot.qualifies) return 'patreon';
  if (!INSTALLABLE_KINDS.includes(kind)) return 'unsupported';
  if (snapshot.installed.some((item) => item.id === id)) return 'installed';

  return snapshot.entitled.some((item) => item.id === id) ? 'install' : 'patreon';
}
