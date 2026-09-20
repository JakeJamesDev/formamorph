import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Section, CheckRow } from "@/components/SettingsRows";
import { useMountedRef } from "@/lib/useMountedRef";
import { markCatalogStale } from "@/lib/catalogStale";
import ServerSettingsService, { ANONYMOUS_LIKES } from "@/services/ServerSettingsService";

/** One on/off setting with a control here. A second one is another entry, not another component. */
interface FlagSetting {
  /** The server's key for it, which is also the route it is read and written on. */
  key: string;
  /** Title case, as every settings label is. */
  label: string;
  /** The help line beside the box. */
  hint: string;
}

/**
 * The settings an administrator changes from here.
 *
 * Not every setting the server declares: `client_minimums` names internal routes and version numbers,
 * which is a text field's job rather than a box's.
 */
const FLAGS: readonly FlagSetting[] = [
  {
    key: ANONYMOUS_LIKES,
    label: 'Anonymous Likes',
    hint: 'Takes a like from anyone, signed in or not. Switching off keeps the likes already given, and people can still take theirs back.',
  },
];

/** One setting: read when the tab opens, written on a press, and never ahead of the server. */
function FlagRow({ setting, active }: { setting: FlagSetting; active: boolean }) {
  // Null until the server answers. An unread setting is not an off one, and a box that reads off before
  // the answer lands invites a press that turns on what was already on.
  const [value, setValue] = useState<boolean | null>(null);
  const [writing, setWriting] = useState(false);
  const mounted = useMountedRef();

  useEffect(() => {
    if (!active) return;
    let current = true;
    ServerSettingsService.fetchFlag(setting.key)
      .then((stored) => { if (current && mounted.current) setValue(stored); })
      .catch((error: unknown) => {
        if (!current || !mounted.current) return;
        toast.error((error as Error).message || `Failed to read ${setting.label}`);
      });
    return () => { current = false; };
  }, [active, setting.key, setting.label, mounted]);

  // Nothing is set from the press. The box follows what the server stored, so a refusal leaves it where
  // it was without a second render putting it back.
  const press = (next: boolean) => {
    setWriting(true);
    void ServerSettingsService.saveFlag(setting.key, next)
      .then((stored) => {
        if (!mounted.current) return;
        setValue(stored);
        // The catalog carries this setting, so every reader's copy now predates it.
        markCatalogStale();
      })
      .catch((error: unknown) => {
        if (!mounted.current) return;
        toast.error((error as Error).message || `Failed to write ${setting.label}`);
      })
      .finally(() => { if (mounted.current) setWriting(false); });
  };

  return (
    <CheckRow
      label={setting.label}
      htmlFor={`server-setting-${setting.key}`}
      checked={value === true}
      disabled={value === null || writing}
      onChange={press}
      hint={setting.hint}
    />
  );
}

/** Admin Panel → Server. What the server does, changed without a deploy, and live the moment it is written. */
export function ServerSettingsTab({ active }: { active: boolean }) {
  return (
    <div className="py-4 min-w-0">
      <Section title="Server Settings" hint="Takes effect for everyone at once, with no deploy and no confirmation">
        {FLAGS.map((setting) => (
          <FlagRow key={setting.key} setting={setting} active={active} />
        ))}
      </Section>
    </div>
  );
}
