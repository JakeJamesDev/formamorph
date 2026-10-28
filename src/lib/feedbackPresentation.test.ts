import { describe, it, expect } from 'vitest';
import {
  CATEGORY_OPTIONS, DEFAULT_CATEGORY, FEEDBACK_STATUS_STYLES, FEEDBACK_TYPE_LABELS, FILTERED_EMPTY_LABELS,
  SCOPE_LABELS, SEARCH_LABELS, SET_STATUS_OPTIONS, STATUS_OPTIONS, UNRESOLVED_LABELS, UNRESOLVED_STATUSES,
  staffFilterDefaults, statusStyle, userFilterDefaults,
} from './feedbackPresentation';
import { isVotableBoard, type FeedbackStatus } from '@/types';

describe('the question branch', () => {
  it('names itself', () => {
    expect(FEEDBACK_TYPE_LABELS.question).toEqual({ tab: 'Question', one: 'Question', many: 'Questions' });
  });

  it('offers its categories in the server’s order, starting on Gameplay', () => {
    expect(CATEGORY_OPTIONS.question.map((option) => option.label)).toEqual([
      'Gameplay', 'World Editor', 'AI setup & models', 'Community & publishing', 'Account', 'Something else',
    ]);
    expect(DEFAULT_CATEGORY.question).toBe('gameplay');
  });

  it('offers its statuses, badging Answered as done and Closed as muted', () => {
    expect(STATUS_OPTIONS.question.map((option) => option.label)).toEqual(['Open', 'Answered', 'Closed']);
    expect(FEEDBACK_STATUS_STYLES.answered.badge).toBe(FEEDBACK_STATUS_STYLES.resolved.badge);
    expect(FEEDBACK_STATUS_STYLES.closed.badge).toBe(FEEDBACK_STATUS_STYLES.wontfix.badge);
  });

  it('lets staff set only Open and Closed by hand', () => {
    expect(SET_STATUS_OPTIONS.question.map((option) => option.value)).toEqual(['open', 'closed']);
    expect(SET_STATUS_OPTIONS.suggestion).toEqual(STATUS_OPTIONS.suggestion);
  });

  it('counts only an open question as unanswered', () => {
    expect(UNRESOLVED_STATUSES.question).toEqual(['open']);
    expect(UNRESOLVED_LABELS.question).toBe('Unanswered');
  });

  it('words its filters for questions', () => {
    expect(SCOPE_LABELS.question).toEqual({ mine: 'Mine', all: 'Everyone’s' });
    expect(SEARCH_LABELS.question).toBe('Search Questions');
    expect(FILTERED_EMPTY_LABELS.question).toBe('No questions match this filter.');
  });

  it('opens on Everyone’s, Unanswered, Most Voted for players and Unanswered, Most Voted for staff', () => {
    expect(userFilterDefaults('question')).toEqual({ status: 'unresolved', category: 'any', sort: 'votes', scope: 'all' });
    expect(staffFilterDefaults('question')).toEqual({ status: 'unresolved', category: 'any', sort: 'votes' });
  });

  it('leaves the other branches’ player sort on Newest', () => {
    expect(userFilterDefaults('bug').sort).toBe('newest');
    expect(userFilterDefaults('suggestion').sort).toBe('newest');
  });
});

describe('the votable board', () => {
  it('is suggestions and questions, never bugs', () => {
    expect(isVotableBoard('suggestion')).toBe(true);
    expect(isVotableBoard('question')).toBe(true);
    expect(isVotableBoard('bug')).toBe(false);
  });
});

describe('the release statuses', () => {
  it('keeps Pending Release unresolved and closes a duplicate bug', () => {
    expect(UNRESOLVED_STATUSES.bug).toEqual(['open', 'need_info', 'confirmed', 'pending_release']);
    expect(UNRESOLVED_STATUSES.suggestion).toEqual(['open', 'considering', 'planned', 'pending_release']);
  });

  it('labels the suggestion chain in triage order', () => {
    expect(STATUS_OPTIONS.suggestion.map((option) => option.label)).toEqual([
      'Open', 'Considering', 'Planned', 'Pending Release', 'Declined', 'Added',
    ]);
  });

  it('badges Duplicate as turned down', () => {
    expect(FEEDBACK_STATUS_STYLES.duplicate.badge).toBe(FEEDBACK_STATUS_STYLES.wontfix.badge);
  });

  it('falls back to a muted badge for a status this build does not know', () => {
    const style = statusStyle('needs_triage' as FeedbackStatus);

    expect(style).toEqual({ label: 'Needs Triage', badge: FEEDBACK_STATUS_STYLES.closed.badge, dot: FEEDBACK_STATUS_STYLES.closed.dot });
    expect(statusStyle('planned')).toBe(FEEDBACK_STATUS_STYLES.planned);
  });
});
