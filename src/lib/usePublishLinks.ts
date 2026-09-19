import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AuthService from '@/services/AuthService';
import type { ListingDetails } from '@/services/WorldStorageService';
import WorldStorageService from '@/services/WorldStorageService';
import type { CatalogKind } from '@/lib/catalogKinds';
import {
  compatibleWorldRows, declaresCompatibility, offeredWorldIds, promptCompatibleRows, type CompatibleWorldRow,
} from '@/lib/compatibleWorlds';
import { libraryItemData, libraryItems, type LibraryItemSummary } from '@/lib/librarySources';
import { linkLibraryItemToListing } from '@/lib/librarySources';
import {
  declaresDependencies, hasLinkedContent, linkedContentRows, requiredSourceIds, sourcesToPublish,
  worldPublishContent,
  type LinkedContentRow, type LinkedWorldContent, type ListingVisibility,
} from '@/lib/publishLinks';
import { dictionaryPublishPayload, entityPublishPayload, type PublishPayload } from '@/lib/publishPayload';
import { readWorldPromptPins } from '@/lib/worldPromptPreset';
import type { Dictionary, Entity } from '@/types';

/** One source this publish could not create a listing for. */
export interface SourceFailure {
  name: string;
  message: string;
}

/** Publish one payload and answer with the listing it became. The modal supplies this so every publish in
 *  the run goes through the same request, limits, and refusals. */
export type PublishOne = (payload: PublishPayload) => Promise<{ _id?: string; id?: string } | null>;

/** Which kinds carry a Listing choice and Compatible Worlds. A world is always public, and an Avatar has
 *  no link to anything. */
const isComponent = (kind: CatalogKind) => kind === 'entity' || kind === 'dictionary';
/** Which kinds carry Compatible Worlds: the components, and a prompt, which offers itself but has no Listing
 *  choice. */
export const offersCompatibility = (kind: CatalogKind) => isComponent(kind) || kind === 'prompt';

/**
 * The publish dialog's linked-content state: what a world declares as required, and what a component is
 * offered for.
 *
 * `listing` is the overwrite target's own relationships, which is what remembers the author's choices
 * between publications; pass null while publishing something new. The rows stay empty until everything
 * they are derived from has arrived, so no row is ever drawn with a default the next render corrects.
 */
export function usePublishLinks({ open, kind, contentData, localId, overwriteTarget, listing, listingPending }: {
  open: boolean;
  kind: CatalogKind;
  /** The payload's content: a world for the world rows, ignored for a component. */
  contentData: unknown;
  /** The local record this payload came from: a world, the library item behind a component, or a preset. */
  localId?: string;
  overwriteTarget: string | null;
  listing: ListingDetails | null;
  /** A request for the overwrite target's relationships is still out. A row drawn now would carry a
   *  default the answer corrects, so the rows wait. A request that failed is not pending: the dialog
   *  then knows only what the world itself says, which is what the rows are built from. */
  listingPending: boolean;
}) {
  const [linkedRows, setLinkedRows] = useState<LinkedContentRow[]>([]);
  const [compatRows, setCompatRows] = useState<CompatibleWorldRow[]>([]);
  /** The author's Listing choice, or null while they have made none. Null is what keeps a publish from
   *  stating a visibility it never loaded: a dialog opened over an unlisted listing and published
   *  without touching the control would otherwise send `public` and list it. */
  const [visibilityChoice, setVisibilityChoice] = useState<ListingVisibility | null>(null);
  const [sourceFailures, setSourceFailures] = useState<SourceFailure[]>([]);
  /** Library id to the listing it was published as in this run. A retry reads it so a source that already
   *  went up is never published a second time. */
  const resolved = useRef<Record<string, string>>({});

  /** The listing's own required set. Null when this publish creates the listing, and null again when the
   *  read failed — a publish must not clear a set it could not read. */
  const listingRequired = overwriteTarget ? listing?.requiredDependencies ?? null : null;
  /** What the rows check from. An unread listing checks nothing, so a failed read never publishes a
   *  source the author did not ask for. */
  const rowDefaults = useMemo(
    () => (overwriteTarget ? listingRequired ?? [] : null),
    [overwriteTarget, listingRequired],
  );
  /** The listing's visibility today. A new listing is created public unless the author says otherwise. */
  const currentVisibility: ListingVisibility = overwriteTarget ? listing?.visibility ?? 'public' : 'public';
  /** What the control shows: the author's choice, else what the listing already is. */
  const visibility = visibilityChoice ?? currentVisibility;

  /**
   * Whether the dialog knows enough to publish.
   *
   * A world that follows a source has no rows until the library read lands, and publishing in that
   * window would embed every copy — the author's checkboxes, unseen and unanswered, delivered as
   * choices they never made. A world that follows nothing states an empty required set whatever the
   * listing says, so it waits for nothing.
   *
   * A component takes both its Listing choice and its offers from the listing, so it waits for that read.
   */
  const ready = kind === 'world'
    ? !(hasLinkedContent(contentData as LinkedWorldContent) && linkedRows.length === 0)
    : !listingPending;

  useEffect(() => {
    if (!open) return;
    resolved.current = {};
    setSourceFailures([]);
    setLinkedRows([]);
    setCompatRows([]);
    setVisibilityChoice(null);
  }, [open, kind, localId]);

  // A world's rows: every library item its content follows, and whether this publish requires it.
  useEffect(() => {
    if (!open || kind !== 'world' || listingPending) return;
    let live = true;
    void (async () => {
      try {
        const [people, books] = await Promise.all([libraryItems('entity'), libraryItems('dictionary')]);
        if (!live) return;
        const library: LibraryItemSummary[] = [...people, ...books];
        setLinkedRows(linkedContentRows(contentData as LinkedWorldContent, library, rowDefaults));
      } catch (error) {
        // An unreadable library cannot say who owns a source or whether it is published. The section
        // stays empty and the publish declares nothing, so the listing keeps the required set it has.
        console.error('Failed to read the library for Linked Content:', error);
      }
    })();
    return () => { live = false; };
  }, [open, kind, contentData, rowDefaults, listingPending]);

  // A prompt's rows: every local world with a listing, the ones pinned to this preset checked when new.
  useEffect(() => {
    if (!open || kind !== 'prompt' || !localId || listingPending) return;
    let live = true;
    void (async () => {
      try {
        const worlds = await WorldStorageService.getWorldMetadata();
        if (!live) return;
        const pins = readWorldPromptPins();
        const published = worlds.flatMap((world) => (
          world.sourceId ? [{ listingId: world.sourceId, name: world.name, pinned: pins[world.id] === localId }] : []
        ));
        setCompatRows(promptCompatibleRows(published, overwriteTarget ? listing?.compatibleWorlds ?? [] : null));
      } catch (error) {
        console.error('Failed to read the local worlds for Compatible Worlds:', error);
      }
    })();
    return () => { live = false; };
  }, [open, kind, localId, overwriteTarget, listing, listingPending]);

  // A component's rows: the author's worlds that have a linked copy of it and a listing of their own.
  useEffect(() => {
    if (!open || !isComponent(kind) || !localId || listingPending) return;
    let live = true;
    void (async () => {
      try {
        const worlds = await WorldStorageService.worldsLinking(localId);
        if (!live) return;
        const eligible = worlds.flatMap((world) => (
          world.sourceId ? [{ listingId: world.sourceId, name: world.name }] : []
        ));
        setCompatRows(compatibleWorldRows(eligible, listing?.compatibleWorlds ?? []));
      } catch (error) {
        // Unreadable local worlds cannot name an eligible world, so the section offers none and the
        // publish declares nothing. The listing keeps the associations it has.
        console.error('Failed to read the local worlds for Compatible Worlds:', error);
      }
    })();
    return () => { live = false; };
  }, [open, kind, localId, overwriteTarget, listing, listingPending]);

  /**
   * Create a listing for every required source that has none, in row order.
   *
   * Each success is written to the library item at once, so a failure later in the run leaves the sources
   * that went up published and out of the next attempt. Answers true when every required source exists.
   */
  const publishSources = useCallback(async (publishOne: PublishOne): Promise<boolean> => {
    const failures: SourceFailure[] = [];
    const author = AuthService.getCurrentUser();

    for (const row of sourcesToPublish(linkedRows, resolved.current)) {
      try {
        const data = await libraryItemData(row.kind, row.libraryId);
        if (!data) throw new Error('This source is no longer in your library.');
        const payload = row.kind === 'dictionary'
          ? dictionaryPublishPayload(data as Dictionary)
          : entityPublishPayload(data as Entity);
        const created = await publishOne({ ...payload, visibility: row.visibility });
        const listingId = created?._id || created?.id;
        if (!listingId) throw new Error('The server did not answer with a listing.');
        resolved.current[row.libraryId] = String(listingId);
        await linkLibraryItemToListing(row.kind, row.libraryId, String(listingId), {
          id: author?.id ? String(author.id) : undefined,
          name: author?.username,
        });
      } catch (error) {
        failures.push({ name: row.name, message: (error as Error).message || 'Failed to publish.' });
      }
    }

    setSourceFailures(failures);
    return failures.length === 0;
  }, [linkedRows]);

  /**
   * The payload with this dialog's declarations on it. Each field is added only where the publish has
   * something to say, so a world with no linked content and a component with no eligible world publish
   * exactly the body they published before this section existed.
   */
  const declarePayload = useCallback((payload: PublishPayload): PublishPayload => {
    if (payload.kind === 'world') {
      // A world that follows nothing requires nothing. Replacing a listing states that, so a listing
      // that still requires a source this world dropped is cleared without reading its set first.
      if (!hasLinkedContent(payload.contentData as LinkedWorldContent)) {
        return overwriteTarget ? { ...payload, requiredDependencies: [] } : payload;
      }

      const required = requiredSourceIds(linkedRows, resolved.current);
      // The content is rewritten whether or not the body names a required set: an unchecked copy is
      // embedded, and an embedded copy carries no link record.
      return {
        ...payload,
        contentData: worldPublishContent(
          payload.contentData as LinkedWorldContent, linkedRows, resolved.current,
        ),
        ...(declaresDependencies(required, listingRequired) ? { requiredDependencies: required } : {}),
      };
    }

    if (!offersCompatibility(payload.kind)) return payload;
    if (payload.kind === 'prompt') {
      return declaresCompatibility(compatRows) ? { ...payload, compatibleWorlds: offeredWorldIds(compatRows) } : payload;
    }
    return {
      ...payload,
      // Stated only where the author chose something other than what the listing already is. An
      // untouched control states nothing, so a listing keeps the visibility it has.
      ...(visibilityChoice && visibilityChoice !== currentVisibility ? { visibility: visibilityChoice } : {}),
      ...(declaresCompatibility(compatRows)
        ? { compatibleWorlds: offeredWorldIds(compatRows, visibility) }
        : {}),
    };
  }, [linkedRows, listingRequired, compatRows, visibility, visibilityChoice, currentVisibility, overwriteTarget]);

  return {
    linkedRows, setLinkedRows,
    compatRows, setCompatRows,
    visibility, setVisibility: setVisibilityChoice,
    sourceFailures,
    ready,
    publishSources, declarePayload,
  };
}
