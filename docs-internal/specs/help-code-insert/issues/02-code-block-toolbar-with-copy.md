# 02: Code Block Toolbar with Copy

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), rulings Q4, Q14.

## What to build

Every fenced code block in the help window, in an AI answer or a guide page, renders as a snippet: Shiki highlighted as today, with a small **Copy** control in its top right that puts the block's text on the clipboard and shows the app's standard copied state. Narration and every other markdown surface stay bare.

Under the surface, the shared markdown renderer gains Streamdown's fence-meta remark plugin, so the info string after the language (`javascript before`) reaches a block renderer as its meta. The help window's reader components, which already replace links, gain a block-code renderer that wraps Streamdown's default highlighted block in the toolbar. The wrapper exposes the block's text and meta so ticket 05 can add Insert without touching the renderer again. Streamdown's own controls stay off.

Workload: Streamdown's component merge and plugin identity rules are easy to get subtly wrong (memoization on plugin-array identity, the block `code` override replacing the highlighter). A top model at high effort.

## Acceptance criteria

- [ ] An answer with a fence shows a highlighted block with a Copy control; clicking it writes the block text to the clipboard and shows the copied state
- [ ] A guide page's fence shows the same Copy control
- [ ] A flagged answer's fence shows Copy
- [ ] Narration, world descriptions, the changelog and reasoning asides render fences with no controls
- [ ] The fence meta reaches the block renderer: a test renders `javascript before` and the block carries `before` as its meta
- [ ] Highlighting is unchanged: the block still carries Shiki's themed spans
- [ ] Streaming answers keep working: a fence that is still open while the answer streams renders without a toolbar error
- [ ] Toolbar follows the Design System icon-button pattern; both themes checked in the help window at a realistic viewport
- [ ] Changelog line under In Progress, Added, 👤
