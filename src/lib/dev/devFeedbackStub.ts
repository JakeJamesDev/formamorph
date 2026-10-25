/** DEV only: serves `FeedbackService` from an in-memory board while the dev route has `fixture=feedback`. */
import { FEEDBACK_SEARCH_MAX } from '@/components/menu/FeedbackSearchInput';
import { getDevRoute } from '@/lib/devRouter';
import type { FeedbackSort } from '@/lib/feedbackPresentation';
import AuthService from '@/services/AuthService';
import FeedbackService from '@/services/FeedbackService';
import type { FeedbackComment, FeedbackDetail, FeedbackStatus, FeedbackThread } from '@/types';

export const DEV_FEEDBACK_FIXTURE = 'feedback';

const STUBBED_KEYS = [
  'file', 'list', 'fetchThread', 'comment', 'editComment', 'removeComment', 'setVote', 'update',
  'setStatus', 'setLocked', 'remove', 'fetchUnreadCount',
] as const satisfies readonly (keyof typeof FeedbackService)[];
type Stubbed = Pick<typeof FeedbackService, (typeof STUBBED_KEYS)[number]>;

/** The signed-in account's id, or a stand-in so "Mine" still has rows when signed out. */
const viewerId = (): string => {
  const id = (AuthService.getCurrentUser() as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : 'dev-user';
};

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

const person = (id: string, username: string, role: string | null = null) => ({ id, username, role, avatarUrl: null });

/**
 * One thread, filled in around the fields that matter for the screen being checked.
 *
 * @param fields - The thread's own values; the rest default to an open, unvoted thread by another player
 * @returns The thread
 */
export function devFeedbackFixtureThread(fields: Partial<FeedbackThread> & Pick<FeedbackThread, 'id' | 'type' | 'title' | 'category'>): FeedbackThread {
  const at = hoursAgo(48);
  return {
    body: 'A few sentences about it, as a player would write them.',
    status: 'open',
    reporter: person('dev-other', 'Lantern Keeper'),
    diagnostics: {},
    locked: false,
    editedAt: null,
    votes: 1,
    voted: false,
    commentCount: 0,
    createdAt: at,
    updatedAt: at,
    unread: false,
    ...fields,
  };
}

/** The board the stub starts from: a few of each branch, with one answered question that has replies. */
export function devFeedbackFixtures(): FeedbackDetail[] {
  const me = viewerId();
  const reply = (id: string, body: string, author: FeedbackComment['author'], hours: number): FeedbackComment =>
    ({ id, body, createdAt: hoursAgo(hours), editedAt: null, author });
  return [
    {
      thread: devFeedbackFixtureThread({
        id: 'dev-question-answered', type: 'question', category: 'setup', status: 'answered', votes: 9, commentCount: 2,
        title: 'How do I point the game at a model running on my own PC?',
        body: 'I have a model loaded in a local server, but the game still uses the default endpoint.',
        updatedAt: hoursAgo(3),
      }),
      comments: [
        reply('dev-reply-1', 'Settings → Endpoints takes the local server’s address. Select **Test** after you save it.', person('dev-staff', 'Formamorph Team', 'dev'), 5),
        reply('dev-reply-2', 'That worked, thanks. I had the port wrong.', person('dev-other', 'Lantern Keeper'), 3),
      ],
    },
    {
      thread: devFeedbackFixtureThread({
        id: 'dev-question-open', type: 'question', category: 'editor', votes: 14, voted: true,
        title: 'Can a stat change when the player enters a location?',
        body: 'I want warmth to drop each time the player walks into the cave.',
      }),
      comments: [],
    },
    {
      thread: devFeedbackFixtureThread({
        id: 'dev-question-mine', type: 'question', category: 'account', votes: 2, voted: true, unread: true, commentCount: 1,
        reporter: person(me, 'Sample Player'),
        title: 'Where do I change my username?',
      }),
      comments: [reply('dev-reply-3', 'Account → Settings, under **Username**.', person('dev-other', 'Lantern Keeper'), 1)],
    },
    {
      thread: devFeedbackFixtureThread({
        id: 'dev-question-closed', type: 'question', category: 'gameplay', status: 'closed', locked: true, votes: 1,
        title: 'Is there a way to undo the last turn?',
      }),
      comments: [],
    },
    {
      thread: devFeedbackFixtureThread({
        id: 'dev-suggestion', type: 'suggestion', category: 'interface', votes: 6,
        title: 'Let me pin a stat to the top of the panel',
      }),
      comments: [],
    },
    {
      thread: devFeedbackFixtureThread({
        id: 'dev-bug', type: 'bug', category: 'visuals', votes: 0, reporter: person(me, 'Sample Player'),
        diagnostics: { version: '3.1.2', platform: 'browser', system: 'Windows 11' },
        title: 'The map stops panning after a long session',
      }),
      comments: [],
    },
  ];
}

/** The server's search words: distinct, lower-cased, 3+ characters or a 2-letter capital word (AI, UI). */
export function searchWords(search: string | undefined): string[] {
  const kept = (search ?? '').trim().slice(0, FEEDBACK_SEARCH_MAX).split(/\s+/).filter((word) => word.length >= 3 || /^[A-Z]{2}$/.test(word));
  return [...new Set(kept.map((word) => word.toLowerCase()))];
}

const SORTS: Record<FeedbackSort, (a: FeedbackThread, b: FeedbackThread) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  active: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  votes: (a, b) => b.votes - a.votes || b.createdAt.localeCompare(a.createdAt),
};

/**
 * The stubbed methods over one in-memory board. Each call answers as the server would for the fields the
 * screens read; permissions are not checked.
 *
 * @param board - The threads and their replies, changed in place by writes
 * @returns The methods to put on `FeedbackService`
 */
export function devFeedbackMethods(board: FeedbackDetail[]): Stubbed {
  const find = (id: string): FeedbackDetail => {
    const detail = board.find((entry) => entry.thread.id === id);
    if (!detail) throw new Error('Not found');
    return detail;
  };
  const touch = (detail: FeedbackDetail, fields: Partial<FeedbackThread>): FeedbackThread => {
    detail.thread = { ...detail.thread, ...fields, updatedAt: new Date().toISOString() };
    return detail.thread;
  };
  const author = () => person(viewerId(), 'Sample Player');

  return {
    async file(draft) {
      const thread = devFeedbackFixtureThread({
        ...draft, id: `dev-filed-${Date.now()}`, reporter: author(), votes: draft.type === 'bug' ? 0 : 1,
        voted: draft.type !== 'bug', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      board.unshift({ thread, comments: [] });
      return thread;
    },
    async list({ type, page = 1, limit = 20, status, category, scope, sort, search }) {
      const statuses = status ? [status].flat() : [];
      const words = searchWords(search);
      const hits = (thread: FeedbackThread): number => {
        const text = `${thread.title} ${thread.body}`.toLowerCase();
        return words.filter((word) => text.includes(word)).length;
      };
      const me = viewerId();
      const rows = board.map((entry) => entry.thread).filter((thread) =>
        thread.type === type
        && (!statuses.length || statuses.includes(thread.status))
        && (!category || thread.category === category)
        && (scope === 'all' || thread.reporter.id === me)
        && (!words.length || hits(thread) > 0));
      const order = SORTS[(sort ?? 'newest') as FeedbackSort];
      rows.sort((a, b) => hits(b) - hits(a) || order(a, b));
      return { threads: rows.slice((page - 1) * limit, page * limit), total: rows.length };
    },
    async fetchThread(id) {
      const detail = find(id);
      detail.thread = { ...detail.thread, unread: false };
      return { thread: detail.thread, comments: [...detail.comments] };
    },
    async comment(id, body) {
      const detail = find(id);
      const added: FeedbackComment = { id: `dev-reply-${Date.now()}`, body, createdAt: new Date().toISOString(), editedAt: null, author: author() };
      detail.comments = [...detail.comments, added];
      touch(detail, { commentCount: detail.comments.length });
      return added;
    },
    async editComment(id, commentId, body) {
      const detail = find(id);
      const edited = { ...detail.comments.find((comment) => comment.id === commentId)!, body, editedAt: new Date().toISOString() };
      detail.comments = detail.comments.map((comment) => (comment.id === commentId ? edited : comment));
      return edited;
    },
    async removeComment(id, commentId) {
      const detail = find(id);
      detail.comments = detail.comments.filter((comment) => comment.id !== commentId);
      touch(detail, { commentCount: detail.comments.length });
    },
    async setVote(id, voted) {
      const detail = find(id);
      const votes = detail.thread.votes + (voted === detail.thread.voted ? 0 : voted ? 1 : -1);
      return touch(detail, { voted, votes });
    },
    async update(id, fields) {
      const detail = find(id);
      const moved = fields.type !== undefined && fields.type !== detail.thread.type;
      return touch(detail, { ...fields, ...(moved ? { status: 'open' as FeedbackStatus, diagnostics: {} } : {}) });
    },
    async setStatus(id, status) {
      const detail = find(id);
      // Closing a question locks it; reopening unlocks it.
      const lock = detail.thread.type === 'question' ? { locked: status === 'closed' } : {};
      return touch(detail, { status, ...lock });
    },
    async setLocked(id, locked) {
      return touch(find(id), { locked });
    },
    async remove(id) {
      const index = board.findIndex((entry) => entry.thread.id === id);
      if (index >= 0) board.splice(index, 1);
    },
    async fetchUnreadCount() {
      return board.filter((entry) => entry.thread.unread).length;
    },
  };
}

let stubbed = false;

/** Shadows the class methods with the stub while the route asks for it; deleting the shadows restores them. */
function sync(): void {
  const wanted = getDevRoute()?.fixture === DEV_FEEDBACK_FIXTURE;
  if (wanted === stubbed) return;
  if (wanted) Object.assign(FeedbackService, devFeedbackMethods(devFeedbackFixtures()));
  else for (const key of STUBBED_KEYS) delete (FeedbackService as Partial<Stubbed>)[key];
  stubbed = wanted;
}

/** Watches the dev route for `fixture=feedback`. A no-op outside DEV. */
export function installDevFeedbackStub(): void {
  if (!import.meta.env.DEV) return;
  sync();
  window.addEventListener('hashchange', sync);
}
