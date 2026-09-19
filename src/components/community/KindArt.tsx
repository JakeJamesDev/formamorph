import { KIND_ICONS, KIND_LABELS, type CatalogKind } from "@/lib/catalogKinds";
import { cn } from "@/lib/utils";

/** The cover a listing with no art wears: its kind icon, centered on the muted frame. */
export function KindArt({ kind, className, iconClassName = "h-12 w-12" }: {
  kind: CatalogKind;
  className?: string;
  iconClassName?: string;
}) {
  const Icon = KIND_ICONS[kind];

  return (
    <div
      role="img"
      aria-label={KIND_LABELS[kind].one}
      className={cn("w-full h-full flex items-center justify-center bg-muted text-muted-foreground", className)}
    >
      <Icon className={iconClassName} aria-hidden />
    </div>
  );
}
