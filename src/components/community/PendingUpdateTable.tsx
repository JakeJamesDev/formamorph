import { useEffect, useState, type ReactNode } from "react";
import { CHIP_BASE } from "@/components/Chip";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";
import { Skeleton } from "@/components/ui/skeleton";
import { formatChangelogDate, type ChangelogEntry } from "@/lib/listingChangelog";
import { changedFields, fieldLabel, type PendingChangelogOp, type PendingUpdate } from "@/lib/listingModeration";
import { useMountedRef } from "@/lib/useMountedRef";
import { usePendingThumbnail } from "@/lib/usePendingThumbnail";
import { cn } from "@/lib/utils";
import WorldStorageService from "@/services/WorldStorageService";

interface PendingUpdateTableProps {
  update: PendingUpdate;
  /** The live thumbnail's URL, absent when the listing has none. */
  liveThumbnail?: string;
  /** The approved entries, so a held edit or delete names the entry it changes. */
  approvedChangelog?: ChangelogEntry[] | null;
}

/** The fields whose values are listing ids, shown by name. */
const ID_LIST_FIELDS = new Set(['required_dependencies', 'compatible_worlds']);

const OP_LABELS: Record<PendingChangelogOp['op'], string> = { create: 'Add', edit: 'Edit', delete: 'Delete' };

const VISIBILITY_LABELS: Record<string, string> = { public: 'Public', unlisted: 'Unlisted' };

const none = <span className="text-muted-foreground">None</span>;

/** What a listing id shows as: its name, or why the reader can't see one. */
type ListingName = string | { gone: 'removed' | 'hidden' };

/** The names of the listings `ids` name, read one at a time. */
function useListingNames(ids: string[]): Map<string, ListingName> {
  const [names, setNames] = useState<Map<string, ListingName>>(new Map());
  const mounted = useMountedRef();
  const key = [...new Set(ids)].sort().join(',');

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    for (const id of key.split(',')) {
      void WorldStorageService.readListingDetails(id, controller.signal).then((read) => {
        if (!mounted.current || controller.signal.aborted) return;
        const name: ListingName = read.status === 'ok'
          ? read.details.name ?? id
          : read.status === 'gone' ? { gone: read.hidden ? 'hidden' : 'removed' } : id;
        setNames((prev) => new Map(prev).set(id, name));
      });
    }

    return () => controller.abort();
  }, [key, mounted]);

  return names;
}

/** A list value as chips. An item the other side lacks is marked: struck out when live, Added when pending. */
function ChipList({ items, other, side, nameOf }: {
  items: string[];
  other: string[];
  side: 'live' | 'pending';
  nameOf?: (item: string) => ReactNode;
}) {
  if (items.length === 0) return none;

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => {
        const only = !other.includes(item);
        return (
          <span
            key={item}
            className={cn(
              CHIP_BASE, "bg-secondary text-secondary-foreground",
              only && side === 'live' && "line-through opacity-70",
              only && side === 'pending' && "ring-1 ring-inset ring-success",
            )}
          >
            {nameOf ? nameOf(item) : item}
            {only && <span className="sr-only">{side === 'live' ? ' (removed)' : ' (added)'}</span>}
          </span>
        );
      })}
    </div>
  );
}

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function licenseText(value: unknown): ReactNode {
  if (!value || typeof value !== 'object') return none;
  const license = value as { title?: unknown; licenseName?: unknown };
  const parts = [license.title, license.licenseName].filter((part): part is string => typeof part === 'string' && part !== '');

  return parts.length ? parts.join(' · ') : 'Set';
}

function Thumb({ src, alt, loading }: { src?: string; alt: string; loading?: boolean }) {
  if (loading) return <Skeleton className="h-24 w-24 rounded-md" />;
  if (!src) return none;

  return <img src={src} alt={alt} className="h-24 w-24 rounded-md border border-border object-cover" />;
}

/**
 * A pending update beside the live listing: one row per changed field, live then pending, then the held
 * changelog operations in the order the author made them.
 */
export function PendingUpdateTable({ update, liveThumbnail, approvedChangelog }: PendingUpdateTableProps) {
  const fields = changedFields(update);
  const pendingThumb = usePendingThumbnail(update.thumbnail_url);
  const idValues = fields
    .filter((name) => ID_LIST_FIELDS.has(name))
    .flatMap((name) => [...asList(update.fields?.[name]?.approved), ...asList(update.fields?.[name]?.pending)]);
  const names = useListingNames(idValues);
  const ops = update.changelog ?? [];

  const nameOf = (id: string): ReactNode => {
    const name = names.get(id);
    if (name === undefined) return <span className="text-muted-foreground">Loading…</span>;
    if (typeof name === 'string') return name;

    return <span className="italic">{name.gone === 'hidden' ? 'Hidden listing' : 'Removed listing'}</span>;
  };

  const value = (name: string, side: 'live' | 'pending'): ReactNode => {
    if (name === 'thumbnail') {
      return side === 'live'
        ? <Thumb src={liveThumbnail} alt="Live thumbnail" />
        : <Thumb
            src={pendingThumb.status === 'ready' ? pendingThumb.src : undefined}
            alt="Pending thumbnail"
            loading={pendingThumb.status === 'loading'}
          />;
    }
    if (name === 'content') return side === 'live' ? 'Current file' : 'New file';

    const change = update.fields?.[name];
    const raw = side === 'live' ? change?.approved : change?.pending;
    const other = side === 'live' ? change?.pending : change?.approved;

    if (ID_LIST_FIELDS.has(name)) return <ChipList items={asList(raw)} other={asList(other)} side={side} nameOf={nameOf} />;
    if (name === 'tags' || name === 'models') return <ChipList items={asList(raw)} other={asList(other)} side={side} />;
    if (name === 'spoiler') return raw ? 'Yes' : 'No';
    if (name === 'visibility') return typeof raw === 'string' ? VISIBILITY_LABELS[raw] ?? raw : none;
    if (name === 'model_license') return licenseText(raw);
    if (typeof raw === 'string') return raw ? <span className="whitespace-pre-wrap break-words">{raw}</span> : none;

    return raw === null || raw === undefined ? none : JSON.stringify(raw);
  };

  const approvedTitle = (id: string) => approvedChangelog?.find((entry) => entry.id === id)?.title;

  return (
    <div className="space-y-4 min-w-0">
      {fields.length > 0 && (
        <table className="w-full table-fixed border-collapse text-helper" aria-label="Changed Fields">
          <thead>
            <tr className="border-b border-border text-left text-meta text-muted-foreground">
              <th scope="col" className="w-28 py-1.5 pr-3 font-semibold">Field</th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">Live</th>
              <th scope="col" className="py-1.5 font-semibold">Pending</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((name) => (
              <tr key={name} className="border-b border-border/50 align-top last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-medium">{fieldLabel(name)}</th>
                <td className="py-2 pr-3 text-muted-foreground min-w-0">{value(name, 'live')}</td>
                <td className="py-2 min-w-0">{value(name, 'pending')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {ops.length > 0 && (
        <div className="space-y-2 min-w-0">
          <h3 className="text-helper font-semibold text-muted-foreground">Changelog</h3>
          <ol className="space-y-2" aria-label="Changelog Changes">
            {ops.map((op, index) => (
              <li key={`${op.id}-${index}`} className="border-b border-border/50 pb-2 last:border-0 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-meta">{OP_LABELS[op.op]}</span>
                    <span className="font-medium">
                      {op.op === 'delete' ? approvedTitle(op.id) ?? 'An entry' : op.title}
                    </span>
                  </span>
                  {op.op !== 'delete' && (
                    <span className="shrink-0 text-meta text-muted-foreground">{formatChangelogDate(op.date)}</span>
                  )}
                </div>
                {op.op !== 'delete' && op.body && (
                  <div className="mt-1 min-w-0 text-muted-foreground"><MarkdownRenderer text={op.body} /></div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
