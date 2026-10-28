/**
 * A request, from anywhere in the app, to open one listing in Community Creations. The main menu answers it;
 * a request made in game waits until the main menu mounts.
 */
import { useSyncExternalStore } from 'react';
import type { CatalogKind } from '@/lib/catalogKinds';

export interface CommunityListingRequest {
  readonly id: string;
  readonly kind: CatalogKind;
  /** Tells two requests for the same listing apart. */
  readonly nonce: number;
}

let pending: CommunityListingRequest | null = null;
let nonce = 0;
const listeners = new Set<() => void>();

const publish = (next: CommunityListingRequest | null) => {
  pending = next;
  listeners.forEach((listener) => listener());
};

/** Asks the main menu to open `id` in Community Creations, in place of any request still waiting. */
export function requestCommunityListing(listing: { id: string; kind: CatalogKind }): void {
  nonce += 1;
  publish({ ...listing, nonce });
}

/** Clears the request `nonce` names, once it is answered. A newer request stays. */
export function clearCommunityListingRequest(answered: number): void {
  if (pending?.nonce === answered) publish(null);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** The request waiting for an answer, or null. */
export const useCommunityListingRequest = (): CommunityListingRequest | null => useSyncExternalStore(subscribe, () => pending);
