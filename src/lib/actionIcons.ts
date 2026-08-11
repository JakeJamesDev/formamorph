import {
  Download, Upload, CloudUpload, CloudDownload, ImageDown, CloudSync, CloudBackup, Copy,
  type LucideIcon,
} from "lucide-react";

/**
 * One icon per file/library action, shared by every button that offers it. Direction is read from the
 * app's point of view: a file arrives on import, leaves on export. Rebinding a token here changes
 * every surface at once.
 */
export const ActionIcon = {
  import: Download,
  export: Upload,
  publish: CloudUpload,
  availableOffline: ImageDown,
  /** Community: fetch a copy you don't have yet. */
  cloudDownload: CloudDownload,
  /** Community: a newer version exists — pull it over your copy. */
  cloudUpdate: CloudSync,
  /** Community: you already have the current version — fetch it again. */
  cloudRefresh: CloudBackup,
  copy: Copy,
} satisfies Record<string, LucideIcon>;
