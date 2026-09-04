/**
 * DEV: a canned Privacy Policy for `#dev?modal=privacyPolicy`.
 *
 * The real one is a server row that ships switched off, so on any machine without an enabled policy the
 * prompt has nothing to render. This stands in, so its copy and its two buttons stay checkable offline.
 */
import type { AnswerablePolicy } from '@/types';

export const DEV_PRIVACY_SAMPLE: AnswerablePolicy = {
  title: 'Privacy Policy',
  tags: [],
  accepted: false,
  body: [
    'This is sample text, shown only in a development build.',
    '',
    '**What we store.** Your username, a hash of your password, and anything you publish.',
    '',
    '**Network address.** A salted hash of it is kept for 90 days and used only to detect abuse. It is',
    'never acted on automatically.',
    '',
    '**Deleting your account.** You can ask from your profile. There is a seven-day window in which',
    'logging back in cancels the request.',
  ].join('\n'),
};
