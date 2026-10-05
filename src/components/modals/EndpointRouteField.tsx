import { HintInfo } from '@/components/SettingsRows';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from '@/components/ui/select';
import { EndpointReachabilityBadge } from './EndpointReachabilityBadge';
import type { ReachabilityTarget } from '@/lib/useEndpointReachable';
import type { TargetAttribute } from '@/lib/surface/surfaceTargets';

/** Sentinel for the Use Active Endpoint row — Radix Select cannot hold an empty-string value, and "unpinned" is
 *  stored as an absent entry rather than an id. */
const FOLLOW_ACTIVE = '__follow__';

/**
 * Which text-endpoint preset a request sends to. Use Active Endpoint (`null`) follows the globally-selected
 * preset; any other choice pins this request alone. A pin naming a deleted preset is the caller's to map to `null`.
 */
export function EndpointRouteField({ label, description, info, value, activeName, extraRows = [], presets, onChange, reachability, disabled, target }: {
  label: string;
  description: string;
  /** The `ⓘ` markdown, which names where the current choice sends the request. */
  info: string;
  value: string | null;
  activeName: string;
  /** Rows that name no preset, above Use Active Endpoint. Each passes its own value. */
  extraRows?: readonly { value: string; label: string }[];
  presets: { id: string; name: string }[];
  onChange: (id: string | null) => void;
  /** The routed endpoint to probe. `enabled` is false while following the active endpoint, which shows no badge. */
  reachability: ReachabilityTarget;
  disabled?: boolean;
  /** Marks the field as a Take Me There target. */
  target?: TargetAttribute;
}) {
  return (
    <div className="flex flex-col gap-1" {...target}>
      <div className="flex items-center gap-1.5">
        <label className="text-label">{label}</label>
        <HintInfo>{info}</HintInfo>
      </div>
      <span className="text-helper text-muted-foreground">{description}</span>
      <Select
        value={value ?? FOLLOW_ACTIVE}
        onValueChange={(v) => onChange(v === FOLLOW_ACTIVE ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {extraRows.map((row) => <SelectItem key={row.value} value={row.value}>{row.label}</SelectItem>)}
          <SelectItem value={FOLLOW_ACTIVE}>Use Active Endpoint ({activeName})</SelectItem>
          {/* A bare divider rather than a group heading: the two halves still read apart, without a row
              that looks selectable and isn't. */}
          <SelectSeparator />
          {presets.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <EndpointReachabilityBadge target={reachability} />
    </div>
  );
}
