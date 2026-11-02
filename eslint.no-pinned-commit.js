/**
 * A commit sha in source goes red only in CI, whose shallow clone holds no commit it did not fetch.
 * scripts/pinnedCommits.json is the one list, and scripts/fetchPinnedCommits.mjs fetches all of it.
 */
const FULL_SHA = /\b[0-9a-f]{40}\b/;

export const noPinnedCommitRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid a full commit sha in source; read it from scripts/pinnedCommits.json.' },
    schema: [],
    messages: { pinnedCommit: 'A full commit sha belongs in scripts/pinnedCommits.json.' },
  },
  create(context) {
    const check = (node, text) => {
      if (typeof text === 'string' && FULL_SHA.test(text)) context.report({ node, messageId: 'pinnedCommit' });
    };
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.raw),
    };
  },
};
