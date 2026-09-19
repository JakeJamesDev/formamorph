import { useRef, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PublishModal } from '@/components/menu/PublishModal';
import { useSettings } from '@/contexts/SettingsContext';
import AuthService from '@/services/AuthService';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { promptPublishBlock, promptPublishPayload, type PublishPayload } from '@/lib/publishPayload';
import { APP_VERSION } from '@/lib/version';

/**
 * Publish for the active user preset: the empty-Models block, the publish dialog, and the link the preset
 * takes to its listing afterward.
 *
 * @param openModels - Opens the Overview on its Models field
 */
export function usePresetPublish(openModels: () => void) {
  const { presetOverview, activePresetId, exportActivePreset, linkPresetToListing } = useSettings();
  const [payload, setPayload] = useState<PublishPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  // The preset being published, fixed at the start so a selection change mid-publish links the right one.
  const [presetId, setPresetId] = useState<string | null>(null);
  const opener = useRef<Element | null>(null);
  const toOverview = useRef(false);

  const start = () => {
    opener.current = document.activeElement;
    if (promptPublishBlock(presetOverview)) {
      setBlocked(true);
      return;
    }
    setPresetId(activePresetId);
    setPayload(promptPublishPayload(exportActivePreset(APP_VERSION)));
    setOpen(true);
  };

  const dialogs = (
    <>
      <AlertDialog open={blocked} onOpenChange={setBlocked}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            const target = opener.current;
            opener.current = null;
            // The Overview takes focus itself; anywhere else, focus goes back to what opened this.
            if (toOverview.current) { toOverview.current = false; event.preventDefault(); return; }
            if (!(target instanceof HTMLElement) || !target.isConnected) return;
            event.preventDefault();
            target.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Add a Model</AlertDialogTitle>
            <AlertDialogDescription>
              Add at least one model to the <strong>Models</strong> field in the Overview before you publish. Players filter prompts by model.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { toOverview.current = true; openModels(); }}>
              Open Overview
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PublishModal
        open={open}
        onOpenChange={setOpen}
        isAuthenticated={AuthService.isAuthenticated()}
        payload={payload}
        localId={presetId ?? undefined}
        onPublished={(listing) => {
          if (!presetId) return;
          const author = AuthService.getCurrentUser();
          linkPresetToListing(presetId, listing.id, listing.updatedAt, {
            id: author?.id ? String(author.id) : undefined,
            name: author?.username,
          });
        }}
      />
    </>
  );

  return {
    /** Publish shows only for a signed-in user, as it does for every other kind. */
    canPublish: COMMUNITY_ENABLED && AuthService.isAuthenticated(),
    start,
    dialogs,
  };
}
