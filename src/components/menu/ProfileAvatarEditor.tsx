import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { AvatarCropDialog } from "@/components/menu/AvatarCropDialog";
import { AVATAR_ACCEPT, MAX_AVATAR_UPLOAD_BYTES } from "@/lib/avatar";
import AuthService from "@/services/AuthService";

interface ProfileAvatarEditorProps {
  username: string | null | undefined;
  /** The account's current avatar URL, or null. */
  avatarUrl: string | null | undefined;
  /** Fired after a successful change, with the new URL (or null once removed). */
  onChanged: (avatarUrl: string | null) => void;
  /** A suspended account writes nothing, so the controls are shown but inert. */
  disabled?: boolean;
}

/**
 * The reader's own face, in the profile dialog's header, with the controls that change it.
 *
 * The picture is the button: clicking it picks a file, which is where a reader looks first. The remove
 * control is separate and only present when there is something to remove.
 */
export function ProfileAvatarEditor({ username, avatarUrl, onChanged, disabled = false }: ProfileAvatarEditorProps) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [cropping, setCropping] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = (file: File | undefined) => {
    // Reset first: picking the same file twice in a row fires no change event otherwise, which reads as
    // the button being broken.
    if (input.current) input.current.value = '';
    if (!file) return;

    if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
      toast.error(`That image is larger than ${Math.round(MAX_AVATAR_UPLOAD_BYTES / 1024 / 1024)}MB`);
      return;
    }

    setPicked(file);
    setCropping(true);
  };

  const save = async (image: string) => {
    setBusy(true);
    try {
      const url = await AuthService.setAvatar(image);
      onChanged(url);
      setCropping(false);
      setPicked(null);
      toast.success('Profile image updated');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save the profile image');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await AuthService.removeAvatar();
      onChanged(null);
      toast.success('Profile image removed');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to remove the profile image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={disabled || busy}
          aria-label={avatarUrl ? 'Change your profile image' : 'Add a profile image'}
          className="group relative block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserAvatar username={username} avatarUrl={avatarUrl} size="xl" />
          {/* Only on hover: a permanent badge over a face reads as part of the picture. */}
          <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/50 text-white group-hover:flex group-focus-visible:flex">
            <Camera className="h-5 w-5" />
          </span>
        </button>

        <input
          ref={input}
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          aria-label="Profile image file"
          onChange={(event) => pick(event.target.files?.[0])}
        />
      </div>

      {avatarUrl && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 self-end"
          onClick={remove}
          disabled={disabled || busy}
          aria-label="Remove your profile image"
          title="Remove your profile image"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      <AvatarCropDialog
        open={cropping}
        onOpenChange={(open) => { setCropping(open); if (!open) setPicked(null); }}
        file={picked}
        onCropped={save}
        busy={busy}
      />
    </div>
  );
}
