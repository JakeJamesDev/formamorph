import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Section, CheckRow, RowLabel, HintInfo } from "@/components/SettingsRows";
import { Skeleton } from "@/components/ui/skeleton";
import { Meta } from "@/components/ui/typography";
import { useMountedRef } from "@/lib/useMountedRef";
import { markCatalogStale } from "@/lib/catalogStale";
import ServerSettingsService, { ANONYMOUS_LIKES, type ServerSettingKey } from "@/services/ServerSettingsService";

/** One on/off setting with a control here. A second setting is another entry, not another component. */
interface ServerSetting {
  /** The server's key for it, which is also the route it is read and written on. */
  key: ServerSettingKey;
  /** Title case, as every settings label is. */
  label: string;
  /** The brief line beside the box. */
  hint: string;
  /** The facts the brief line leaves out, behind the row's information control. */
  info: string;
}

/**
 * The settings an administrator changes here.
 *
 * Not every setting the server declares. `client_minimums` holds route names and version numbers, which
 * a text field edits, not a box.
 */
const SETTINGS: readonly ServerSetting[] = [
  {
    key: ANONYMOUS_LIKES,
    label: 'Anonymous Likes',
    hint: 'Takes a like from anyone, signed in or not',
    info: 'Likes already given stay counted. Anyone can still take their own like back.',
  },
];

/** One setting: read when the tab opens, written on a press, and never ahead of the server. */
function SettingRow({ setting, active }: { setting: ServerSetting; active: boolean }) {
  // Null until the server answers. An unread setting is not an off one, so the row shows a placeholder
  // rather than an empty box: a dimmed empty box reads as off and invites a press that switches on what
  // is already on.
  const [value, setValue] = useState<boolean | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [writing, setWriting] = useState(false);
  const mounted = useMountedRef();

  useEffect(() => {
    if (!active) return;
    let current = true;
    ServerSettingsService.fetchSetting(setting.key)
      .then((stored) => { if (current && mounted.current) setValue(stored); })
      .catch((error: unknown) => {
        if (!current || !mounted.current) return;
        setUnreadable(true);
        toast.error((error as Error).message || `Failed to read ${setting.label}`);
      });
    return () => { current = false; };
  }, [active, setting.key, setting.label, mounted]);

  // The press sets nothing. The box resolves to the value the server stored, so a refusal leaves it as it
  // was without a second render to restore it.
  const press = (next: boolean) => {
    setWriting(true);
    void ServerSettingsService.saveSetting(setting.key, next)
      .then((stored) => {
        if (!mounted.current) return;
        setValue(stored);
        // The catalog response carries this setting, so every cached copy is now out of date.
        markCatalogStale();
      })
      .catch((error: unknown) => {
        if (!mounted.current) return;
        toast.error((error as Error).message || `Failed to write ${setting.label}`);
      })
      .finally(() => { if (mounted.current) setWriting(false); });
  };

  const rowId = `server-setting-${setting.key}`;

  // Neither state can show a box: an empty one is indistinguishable from a setting that is off.
  if (value === null) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
        <RowLabel info={<HintInfo>{setting.info}</HintInfo>}>{setting.label}</RowLabel>
        {unreadable
          ? <Meta>This server didn’t answer for this setting</Meta>
          : <Skeleton className="h-4 w-48" />}
      </div>
    );
  }

  return (
    <CheckRow
      label={setting.label}
      htmlFor={rowId}
      checked={value}
      disabled={writing}
      onChange={press}
      hint={setting.hint}
      info={<HintInfo>{setting.info}</HintInfo>}
    />
  );
}

/** Admin Panel, Server tab. What the server does, changed without a deploy and applied at once. */
export function ServerSettingsTab({ active }: { active: boolean }) {
  return (
    <div className="py-4 min-w-0">
      <Section title="Server Settings" hint="Applies to everyone at once, with no deploy and no confirmation">
        {SETTINGS.map((setting) => (
          <SettingRow key={setting.key} setting={setting} active={active} />
        ))}
      </Section>
    </div>
  );
}
