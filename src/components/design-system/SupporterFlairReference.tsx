import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta, SectionTitle } from '@/components/ui/typography';
import { RoleBadge } from '@/components/RoleBadge';
import { SupporterBadge } from '@/components/SupporterBadge';
import { UserAvatar, type AvatarSize } from '@/components/UserAvatar';
import { SUPPORTER_LABELS, SUPPORTER_NAME_STYLES, SUPPORTER_TIERS, supporterRing } from '@/lib/supporterFlair';
import type { SupporterTier } from '@/types';
import { cn } from '@/lib/utils';

const TIERS = SUPPORTER_TIERS;
const SIZES: readonly AvatarSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

type Sample = { name: string; tier?: SupporterTier; role?: string };

const THREAD: readonly Sample[] = [
  { name: 'map-reader' },
  { name: 'river-quill', tier: 'supporter' },
  { name: 'mira-vale', tier: 'supporter_plus' },
  { name: 'wren_hallow', role: 'mod' },
  { name: 'lantern-dev', role: 'dev' },
  { name: 'ferry-admin', role: 'admin' },
];

function Swatch({ tier }: { tier: SupporterTier }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-5 w-5 rounded-full', tier === 'supporter' ? 'bg-supporter' : 'bg-supporter-plus')} aria-hidden="true" />
      <Meta>{tier === 'supporter' ? '--supporter' : '--supporter-plus'}</Meta>
    </div>
  );
}

function ThreadRow({ name, tier, role }: Sample) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserAvatar username={name} size="md" className={tier ? supporterRing(tier, 'md') : undefined} />
      <span className={cn('truncate text-label font-medium', tier && SUPPORTER_NAME_STYLES[tier])}>{name}</span>
      {tier && <SupporterBadge tier={tier} />}
      <RoleBadge role={role} />
    </div>
  );
}

/** One surface of the sample. The class and `data-theme` pin the mode, so both render at once. */
function ThemePanel({ mode, children }: { mode: 'light' | 'dark'; children: React.ReactNode }) {
  return (
    <section
      aria-label={`${mode === 'light' ? 'Light' : 'Dark'} Theme`}
      className={`${mode} min-w-0 space-y-5 rounded-md border border-border bg-background p-4 text-foreground`}
      data-theme="blue"
    >
      <SectionTitle>{mode === 'light' ? 'Light' : 'Dark'}</SectionTitle>
      {children}
    </section>
  );
}

function Sample() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Meta>Tokens</Meta>
        <div className="flex flex-wrap gap-4">{TIERS.map((tier) => <Swatch key={tier} tier={tier} />)}</div>
      </div>
      <div className="space-y-2">
        <Meta>Badges Beside the Staff Badges</Meta>
        <div className="flex flex-wrap items-center gap-2">
          {TIERS.map((tier) => <SupporterBadge key={tier} tier={tier} />)}
          <RoleBadge role="mod" />
          <RoleBadge role="dev" />
          <RoleBadge role="admin" />
        </div>
      </div>
      <div className="space-y-2">
        <Meta>Names</Meta>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-label font-medium">
          <span>Ordinary name</span>
          {TIERS.map((tier) => <span key={tier} className={SUPPORTER_NAME_STYLES[tier]}>{SUPPORTER_LABELS[tier]} name</span>)}
        </div>
      </div>
      <div className="space-y-2">
        <Meta>Profile Image Rings</Meta>
        <div className="flex flex-wrap items-center gap-4">
          {TIERS.map((tier) => (
            <div key={tier} className="flex items-center gap-3 p-1">
              {SIZES.map((size) => <UserAvatar key={size} username="river-quill" size={size} className={supporterRing(tier, size)} />)}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Meta>In a Thread</Meta>
        <div className="space-y-2 rounded-md border border-border bg-card p-3">
          {THREAD.map((sample) => <ThreadRow key={sample.name} {...sample} />)}
        </div>
      </div>
    </div>
  );
}

/** Supporter Flair proposal: tier tokens, badges, names, and Profile Image rings, both themes at once. */
export function SupporterFlairReference() {
  return (
    <Card role="region" aria-labelledby="supporter-flair-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="supporter-flair-reference-title" className="text-heading">Supporter Flair Reference</CardTitle>
        <CardDescription>This proposal shows the tier colors, badges, names, and Profile Image rings.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ThemePanel mode="light"><Sample /></ThemePanel>
        <ThemePanel mode="dark"><Sample /></ThemePanel>
      </CardContent>
    </Card>
  );
}
