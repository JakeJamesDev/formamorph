import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Meta } from '@/components/ui/typography';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KIND_LABELS, kindOf } from '@/lib/catalogKinds';
import { listingId, type AddonRow, type DependencyRow } from '@/lib/worldDependencies';
import type { WorldDownloadPlan } from '@/lib/useWorldDownloadPlan';

/** What each tab is called, and what its list means. */
const TAB_NOTES = {
  required: 'Downloads and links with the world. The world author requires it.',
  approved: 'The world author recommends these add-ons. Pick the ones you want.',
  community: "Other authors offer these add-ons for this world. The world author hasn't reviewed them.",
} as const;

/** Who published a listing, for the line under its name. */
const authorOf = (listing: AddonRow): string => listing.author?.username || 'Another author';

function RequiredRow({ row }: { row: DependencyRow }) {
  const listing = row.listing;
  const name = listing?.name || row.id;
  return (
    <li className="min-w-0">
      <p className="truncate text-label font-medium">{name}</p>
      <Meta as="p">
        {row.status === 'ok' && listing
          ? `${KIND_LABELS[kindOf(listing)].one} · Included`
          : 'This source is no longer on the server.'}
      </Meta>
    </li>
  );
}

function AddonCheckbox({ addon, checked, onChange }: {
  addon: AddonRow;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = listingId(addon);
  const boxId = `addon-${id}`;
  return (
    <li className="flex items-start gap-2">
      {/* The `1lh` sleeve centers the box on the first line of the label beside it. */}
      <span className="flex h-[1lh] shrink-0 items-center">
        <Checkbox
          id={boxId}
          checked={checked}
          onCheckedChange={(next) => onChange(next === true)}
          aria-label={addon.name || 'Untitled'}
        />
      </span>
      <div className="min-w-0">
        <Label htmlFor={boxId} className="block truncate">{addon.name || 'Untitled'}</Label>
        <Meta as="p">
          {KIND_LABELS[kindOf(addon)].one} · {authorOf(addon)}
        </Meta>
      </div>
    </li>
  );
}

/**
 * The world's Linked Content review, as a player about to download it reads it.
 *
 * Required content is listed rather than offered: the world's author decided it. The two add-on tabs are
 * separate so an author's recommendation is never confused with a compatibility claim anyone can make.
 */
export function DownloadLinkedContent({ review }: { review: WorldDownloadPlan }) {
  const { dependencies, tabs, toggle, plan } = review;
  const selected = new Set(plan.addons.map((addon) => addon.id));
  // Always Required first. Choosing a tab from the data would move it under the player as the two reads
  // land at different moments.
  const [tab, setTab] = useState('required');

  if (!review.hasLinkedContent) return null;

  const isSelected = (addon: AddonRow) => selected.has(listingId(addon));
  const addonList = (rows: AddonRow[], note: string) => (
    <>
      <Meta as="p">{note}</Meta>
      {rows.length ? (
        <ul className="mt-2 space-y-2">
          {rows.map((addon) => (
            <AddonCheckbox
              key={listingId(addon)}
              addon={addon}
              checked={isSelected(addon)}
              onChange={(on) => toggle({ id: listingId(addon), name: addon.name || 'Untitled' }, on)}
            />
          ))}
        </ul>
      ) : (
        <Meta as="p" className="mt-2">No add-ons yet.</Meta>
      )}
    </>
  );

  return (
    <div className="col-span-2 rounded-md border p-3">
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <h3 className="text-label font-medium">Linked Content</h3>
          <Meta as="p">
            Required content downloads with the world. Add-ons download only when you pick them.
          </Meta>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-3">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="required">Required ({dependencies.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved Add-ons ({tabs.approved.length})</TabsTrigger>
          <TabsTrigger value="community">Community Add-ons ({tabs.community.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="required">
          <Meta as="p">{TAB_NOTES.required}</Meta>
          {dependencies.length ? (
            <ul className="mt-2 space-y-2">
              {dependencies.map((row) => <RequiredRow key={row.id} row={row} />)}
            </ul>
          ) : (
            <Meta as="p" className="mt-2">This world requires nothing.</Meta>
          )}
        </TabsContent>

        <TabsContent value="approved">{addonList(tabs.approved, TAB_NOTES.approved)}</TabsContent>
        <TabsContent value="community">{addonList(tabs.community, TAB_NOTES.community)}</TabsContent>
      </Tabs>
    </div>
  );
}
