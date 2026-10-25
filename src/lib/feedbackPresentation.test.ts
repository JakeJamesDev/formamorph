import { describe, it, expect } from 'vitest';
import {
  CATEGORY_OPTIONS, DEFAULT_CATEGORY, FEEDBACK_STATUS_STYLES, FEEDBACK_TYPE_LABELS, FILTERED_EMPTY_LABELS,
  SCOPE_LABELS, SEARCH_LABELS, SET_STATUS_OPTIONS, STATUS_OPTIONS, UNRESOLVED_LABELS, UNRESOLVED_STATUSES,
  staffFilterDefaults, userFilterDefaults,
} from './feedbackPresentation';
import { isVotableBoard } from '@/types';

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
