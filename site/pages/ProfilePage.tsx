import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/UserAvatar';
import { RoleBadge } from '@/components/RoleBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileStats } from '@/components/community/ProfileStats';
import { UserCreationsTab } from '@/components/community/UserCreationsTab';
import { parseServerDate } from '@/lib/serverDate';
import UserService from '@/services/UserService';
import type { PublicProfile } from '@/types';
import { SiteAgeGate } from '../components/SiteAgeGate';
import { SiteLayout } from '../components/SiteLayout';
import { NotFoundPage } from './NotFoundPage';

/** What the page is doing while it is not yet showing somebody. */
type State =
  | { status: 'loading' }
  | { status: 'found'; profile: PublicProfile }
  | { status: 'missing' }
  | { status: 'failed'; error: string };

/**
 * Somebody's public face at `formamorph.ai/u/<name>`, for a reader who may never have opened the game.
 *
 * The same content the in-app profile dialog draws, from the same service, so a shared link and the
 * dialog behind a clicked name never disagree. What is missing is the dialog's controls: following and
 * reporting both need an account and a place to put a refusal, and neither is what a shared link is for.
 */
export function ProfilePage({ username }: { username: string }) {
  return (
    <SiteAgeGate>
      <ProfileBody username={username} />
    </SiteAgeGate>
  );
}

function ProfileBody({ username }: { username: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    UserService.fetchProfileByUsername(username)
      .then((profile) => {
        if (cancelled) return;
        setState(profile ? { status: 'found', profile } : { status: 'missing' });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'failed', error: (error as Error).message || 'Failed to load this profile' });
        }
      });

    return () => { cancelled = true; };
  }, [username]);

  // Titled from the answer rather than from the address bar: a name nobody has would otherwise put that
  // name in the tab above a page that says the account is not there.
  useEffect(() => {
    document.title = state.status === 'found'
      ? `${state.profile.username} · Formamorph`
      : 'Formamorph';
  }, [state]);

  // A name nobody has and a suspended account arrive here as the same answer, and leave as the same
  // page. Saying which would make the site a way to ask the server who is suspended.
  if (state.status === 'missing') return <NotFoundPage />;

  const profile = state.status === 'found' ? state.profile : null;
  const memberSince = profile ? parseServerDate(profile.createdAt)?.toLocaleDateString() : null;

  return (
    <SiteLayout width="page">
      <div className="flex flex-col items-center gap-3 text-center min-w-0">
        {profile ? (
          <UserAvatar
            username={profile.username}
            avatarUrl={profile.avatarUrl}
            size="xl"
            // An avatar's initial scales with its circle, not with the type scale, so no role fits.
            className="h-24 w-24 text-4xl"
          />
        ) : (
          <Skeleton className="h-24 w-24 rounded-full" />
        )}

        <div className="min-w-0 space-y-1">
          <div className="flex items-center justify-center gap-2 min-w-0">
            {/* The name off the address bar while the fetch is in flight, so the page opens with the
                thing the reader clicked rather than with a blank. */}
            <h1 className="text-title font-semibold truncate">{profile?.username ?? username}</h1>
            <RoleBadge role={profile?.role} />
          </div>

          {state.status === 'failed' ? (
            <p role="alert" className="text-label text-destructive">{state.error}</p>
          ) : memberSince ? (
            <p className="text-helper text-muted-foreground">Member since {memberSince}</p>
          ) : (
            <Skeleton className="mx-auto h-5 w-32" />
          )}
        </div>

        {profile && <ProfileStats profile={profile} className="justify-center" />}
      </div>

      {/* Display only: opening a listing means opening the game at it, and no such link exists. */}
      {profile && <UserCreationsTab userId={profile.id} username={profile.username} layout="page" />}
    </SiteLayout>
  );
}
