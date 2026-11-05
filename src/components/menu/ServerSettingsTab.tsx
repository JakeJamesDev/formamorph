import { useEffect, useState } from "react";
import { toastError } from "@/lib/linkToast";
import { Section, CheckRow, Row, RowLabel, HintInfo } from "@/components/SettingsRows";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Meta } from "@/components/ui/typography";
import { useMountedRef } from "@/lib/useMountedRef";
import { markCatalogStale } from "@/lib/catalogStale";
import { setListingReviewEnabled, useListingReviewMeta } from "@/lib/useListingReviewMeta";
import { useDevRoute } from "@/lib/devRouter";
import { HostedAiPanel } from "@/components/menu/HostedAiPanel";
import HostedAiAdminService, { type HostedAiAdminApi } from "@/services/HostedAiAdminService";
import ServerSettingsService, {
  ANONYMOUS_LIKES, LISTING_REVIEW, NETWORK_KIND, LIKES_MARKER_MIN_FLAGGED, LIKES_MARKER_SHARE, BURST_SIZE,
  BURST_WINDOW_MINUTES, type ServerSettingKey, type ServerNumberKey,
} from "@/services/ServerSettingsService";

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
  /** Hides the row against a server without listing review, which refuses the key. */
  needsReview?: boolean;
  /** Called with the value the server stored, for surfaces that cache it. */
  onStored?: (value: boolean) => void;
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
  {
    key: LISTING_REVIEW,
    label: 'Listing Review',
    hint: 'Holds new listings and updates for a mod to approve. Pending items stay in the queue when it’s off.',
    info: 'Staff and trusted authors skip review either way. Turning it off approves nothing already waiting.',
    needsReview: true,
    onStored: setListingReviewEnabled,
  },
  {
    key: NETWORK_KIND,
    label: 'Network Check',
    hint: 'Flags new likes from VPN, hosting and Tor networks',
    info: 'Staff see the result in the likes audit and on marked listing cards. Likes and counts don’t change for players.',
  },
];

/** One number with a control here. The server stores it; `scale` is how many shown units make one stored unit. */
interface ServerNumberSetting {
  key: ServerNumberKey;
  /** Title case, as every settings label is. */
  label: string;
  hint: string;
  info: string;
  /** Shown value = stored value × this. The flagged share is stored as 0 to 1 and shown as a percent. */
  scale?: number;
}

/** The thresholds behind the likes marker. The server refuses a value outside its range and says why. */
const NUMBER_SETTINGS: readonly ServerNumberSetting[] = [
  {
    key: LIKES_MARKER_MIN_FLAGGED,
    label: 'Minimum Flagged Likes',
    hint: 'Sets the fewest flagged likes that mark a listing',
    info: 'A flagged like is one Network Check found on a VPN, hosting or Tor network. Counts the last 90 days. The listing also needs the share below.',
  },
  {
    key: LIKES_MARKER_SHARE,
    label: 'Flagged Share',
    hint: 'Sets the percent of recent likes that must be flagged',
    info: 'Counts likes from the last 90 days. The listing also needs the number of flagged likes above.',
    scale: 100,
  },
  {
    key: BURST_SIZE,
    label: 'Burst Size',
    hint: 'Sets how many different likers make a burst',
    info: 'Counts different likers on one listing inside the window below. Each account counts once, and guest likes count once per address.',
  },
  {
    key: BURST_WINDOW_MINUTES,
    label: 'Burst Window',
    hint: 'Sets how many minutes a burst may span',
    info: 'The longest window is 1,440 minutes, which is one day.',
  },
];

/** A stored number as the row shows it, free of float noise from the percent scale. */
const toShown = (stored: number, scale: number) => Number((stored * scale).toFixed(4));

/** One number: read when the tab opens, written on Enter or when the field loses focus, and never ahead of the server. */
function NumberSettingRow({ setting, active }: { setting: ServerNumberSetting; active: boolean }) {
  const scale = setting.scale ?? 1;
  // Null until the server answers, as in SettingRow.
  const [stored, setStored] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [unreadable, setUnreadable] = useState(false);
  const [writing, setWriting] = useState(false);
  const mounted = useMountedRef();

  useEffect(() => {
    if (!active) return;
    let current = true;
    ServerSettingsService.fetchNumber(setting.key)
      .then((value) => {
        if (!current || !mounted.current) return;
        setStored(value);
        setText(String(toShown(value, scale)));
      })
      .catch((error: unknown) => {
        if (!current || !mounted.current) return;
        setUnreadable(true);
        toastError(error, `Failed to read ${setting.label}`);
      });
    return () => { current = false; };
  }, [active, setting.key, setting.label, scale, mounted]);

  // A field left empty or unchanged writes nothing. A refusal puts the stored value back in the field.
  const commit = () => {
    if (stored === null || writing) return;
    const typed = Number(text);
    if (text.trim() === '' || Number.isNaN(typed) || toShown(stored, scale) === typed) {
      setText(String(toShown(stored, scale)));
      return;
    }
    // The server's range is in stored units, which would mislead beside a percent field.
    if (scale !== 1 && (typed <= 0 || typed > scale)) {
      setText(String(toShown(stored, scale)));
      toastError(new Error(`${setting.label} must be above 0 and at most ${scale}`), `Failed to write ${setting.label}`);
      return;
    }

    setWriting(true);
    void ServerSettingsService.saveNumber(setting.key, typed / scale)
      .then((next) => {
        if (!mounted.current) return;
        setStored(next);
        setText(String(toShown(next, scale)));
        // The catalog response carries the markers these thresholds decide.
        markCatalogStale();
      })
      .catch((error: unknown) => {
        if (!mounted.current) return;
        setText(String(toShown(stored, scale)));
        toastError(error, `Failed to write ${setting.label}`);
      })
      .finally(() => { if (mounted.current) setWriting(false); });
  };

  const rowId = `server-setting-${setting.key}`;

  if (stored === null) {
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
    <Row label={setting.label} htmlFor={rowId} hint={setting.hint} info={<HintInfo>{setting.info}</HintInfo>}>
      <Input
        id={rowId}
        type="number"
        inputMode="decimal"
        step={1}
        className="w-32"
        value={text}
        disabled={writing}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      />
    </Row>
  );
}

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
        toastError(error, `Failed to read ${setting.label}`);
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
        setting.onStored?.(stored);
        // The catalog response carries this setting, so every cached copy is now out of date.
        markCatalogStale();
      })
      .catch((error: unknown) => {
        if (!mounted.current) return;
        toastError(error, `Failed to write ${setting.label}`);
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
  const review = useListingReviewMeta(active);
  // DEV: `fixture=hostedAi` swaps the hosted AI routes for an in-memory stand-in.
  const devRoute = useDevRoute();
  const devFixture = import.meta.env.DEV && devRoute?.modal === 'adminPanel' && devRoute.tab === 'serverSettings' && devRoute.fixture === 'hostedAi';
  const [devApi, setDevApi] = useState<HostedAiAdminApi | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV || !devFixture || devApi) return;
    let current = true;
    void import('@/lib/devHostedAiSample').then((loaded) => { if (current) setDevApi(loaded.createDevHostedAiApi()); });
    return () => { current = false; };
  }, [devFixture, devApi]);

  const hostedApi = import.meta.env.DEV && devFixture ? devApi : HostedAiAdminService;

  return (
    <div className="py-4 min-w-0 grid gap-8">
      <Section title="Server Settings" hint="Changes apply to everyone at once, with no confirmation">
        {SETTINGS.filter((setting) => !setting.needsReview || review.supported).map((setting) => (
          <SettingRow key={setting.key} setting={setting} active={active} />
        ))}
        {NUMBER_SETTINGS.map((setting) => (
          <NumberSettingRow key={setting.key} setting={setting} active={active} />
        ))}
      </Section>
      {hostedApi && <HostedAiPanel active={active} api={hostedApi} />}
    </div>
  );
}
