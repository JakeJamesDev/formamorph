import { useState } from "react";
import { cn } from "@/lib/utils";
import { avatarHue, avatarInitial } from "@/lib/avatar";
import { serverAssetSrc } from "@/lib/serverAssets";
import WorldStorageService from "@/services/WorldStorageService";

/** Named sizes rather than a free number: the same face appears at the same few scales throughout. */
const SIZES = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-16 w-16 text-2xl',
} as const;

export type AvatarSize = keyof typeof SIZES;

interface UserAvatarProps {
  /** Whose face this is. Drives the fallback letter and its color. */
  username: string | null | undefined;
  /** The `avatarUrl` from a server DTO, or null for somebody who has not set one. */
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}

/**
 * Somebody's profile image, or a colored initial when they have none.
 *
 * The fallback is a letter rather than a generic silhouette: a row of identical gray circles is harder
 * to read than no circles at all, while a stable per-name color makes a thread scannable at a glance.
 */
export function UserAvatar({ username, avatarUrl, size = 'sm', className }: UserAvatarProps) {
  // A broken image would otherwise leave a torn-page icon where a face should be. Keyed on the URL so a
  // replacement gets its own chance rather than inheriting the last one's failure.
  const [failed, setFailed] = useState<string | null>(null);

  const src = serverAssetSrc(avatarUrl, WorldStorageService.API_URL);
  const showImage = Boolean(src) && failed !== src;

  const shared = cn(
    'shrink-0 rounded-full object-cover select-none',
    SIZES[size],
    className
  );

  if (showImage && src) {
    return (
      <img
        src={src}
        // Read out as the person, not as "avatar" — the name beside it is often the same word, and a
        // screen reader saying it twice is noise.
        alt={username || 'Profile image'}
        loading="lazy"
        onError={() => setFailed(src)}
        className={shared}
      />
    );
  }

  const hue = avatarHue(username);

  return (
    <span
      aria-hidden="true"
      className={cn(shared, 'inline-flex items-center justify-center font-semibold text-white')}
      style={{ backgroundColor: `hsl(${hue} 45% 42%)` }}
    >
      {avatarInitial(username)}
    </span>
  );
}
