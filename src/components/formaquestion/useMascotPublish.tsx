import { useRef, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PublishModal } from '@/components/menu/PublishModal';
import AuthService from '@/services/AuthService';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { toastError } from '@/lib/linkToast';
import { buildMascotPublish } from '@/lib/formaquestion/mascotPublish';
import { buildMascotCardWithLook } from '@/lib/formaquestion/mascotCardFile';
import { bytesToDataUrl } from '@/lib/imageBytes';
import type { MascotThumbnailLooks } from '@/components/menu/PublishModal';
import type { PublishPayload } from '@/lib/publishPayload';
import { useMountedRef } from '@/lib/useMountedRef';
import type { MascotDraftControl } from './useMascotDraft';

/**
 * Publish for the selected custom Mascot: the refusal for bundled art or an over-cap size, the publish
 * dialog, and the link the Mascot takes to its listing afterward. A dirty draft is saved or discarded first.
 */
export function useMascotPublish(control: MascotDraftControl) {
  const mounted = useMountedRef();
  const [payload, setPayload] = useState<PublishPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // The Mascot being published, fixed at the start so a selection change mid-publish links the right one.
  const [mascotId, setMascotId] = useState<string | null>(null);
  const [linkedListingId, setLinkedListingId] = useState<string | undefined>(undefined);
  const [looks, setLooks] = useState<MascotThumbnailLooks | undefined>(undefined);
  const opener = useRef<Element | null>(null);

  const start = () => {
    opener.current = document.activeElement;
    control.guard(() => {
      const { id, name, rig, sourceId } = control.selected();
      void buildMascotPublish(name, rig).then((attempt) => {
        if (!mounted.current) return;
        if (!attempt.allowed) { setRefusal(attempt.message); return; }
        setMascotId(id);
        setLinkedListingId(sourceId);
        setLooks({
          expressions: rig.layers.filter((layer) => layer.kind === 'expression' && layer.enabled).map(({ id: layerId, name: layerName }) => ({ id: layerId, name: layerName })),
          render: async (expression) => {
            const { look } = await buildMascotCardWithLook(name, rig, {}, { expression });
            return bytesToDataUrl(look.bytes, 'image/webp');
          },
        });
        setPayload(attempt.payload);
        setOpen(true);
      }).catch((cause: unknown) => toastError(cause, 'Could not prepare the Mascot to publish.'));
    });
  };

  const dialogs = (
    <>
      <AlertDialog open={refusal !== null} onOpenChange={(next) => { if (!next) setRefusal(null); }}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            const target = opener.current;
            opener.current = null;
            if (!(target instanceof HTMLElement) || !target.isConnected) return;
            event.preventDefault();
            target.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Can&apos;t Publish This Mascot</AlertDialogTitle>
            <AlertDialogDescription>{refusal}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PublishModal
        open={open}
        onOpenChange={setOpen}
        isAuthenticated={AuthService.isAuthenticated()}
        payload={payload}
        localId={mascotId ?? undefined}
        linkedListingId={linkedListingId}
        mascotLooks={looks}
        onPublished={(listing) => {
          if (!mascotId) return;
          const author = AuthService.getCurrentUser();
          control.link(mascotId, {
            sourceId: listing.id,
            ...(listing.updatedAt ? { sourceUpdatedAt: listing.updatedAt } : {}),
            ...(author?.id ? { sourceAuthorId: String(author.id) } : {}),
            ...(author?.username ? { sourceAuthorName: author.username } : {}),
          });
        }}
      />
    </>
  );

  return {
    /** Publish shows only for a signed-in user. */
    canPublish: COMMUNITY_ENABLED && AuthService.isAuthenticated(),
    start,
    dialogs,
  };
}
