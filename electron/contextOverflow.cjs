// Context Overflow: fits a shaped chat prompt into the slot's context by dropping whole messages, with
// LM Studio's three policies. Token counts come from the caller's `count`, which asks the server.

const POLICIES = ['truncateMiddle', 'rollingWindow', 'stopAtLimit'];
const DEFAULT_POLICY = 'truncateMiddle';

/** A stored or IPC value as a policy; anything unknown reads as the default. */
const overflowPolicy = (v) => (POLICIES.includes(v) ? v : DEFAULT_POLICY);

/**
 * `messages` as shaped (an optional system turn on top; the current tool round, if any, follows the last
 * user turn, and with no user turn nothing can be cut). Resolves { messages, tokens } that fit `budget`, or { overflow: { tokens } }
 * with the uncut count when the policy stops or the messages it must keep don't fit. `count(messages)`
 * resolves the rendered prompt's tokens.
 *
 * The dropped block is one run of messages: from just after the first user turn (Truncate Middle) or the
 * system turn (Rolling Window), and never past the last user turn. A cut never ends on a `tool` message, so
 * a tool round drops whole. A cut that keeps the turns alternating wins over a smaller one that doesn't.
 */
async function fitMessages(messages, { policy, budget, count }) {
  const total = await count(messages);
  if (total <= budget) return { messages, tokens: total };
  const overflow = { overflow: { tokens: total } };
  if (overflowPolicy(policy) === 'stopAtLimit') return overflow;

  const lastUser = messages.findLastIndex((m) => m.role === 'user');
  const sys = messages[0]?.role === 'system' ? 1 : 0;
  let from = sys;
  if (overflowPolicy(policy) === 'truncateMiddle') {
    const firstUser = messages.findIndex((m, i) => i >= sys && i < lastUser && m.role === 'user');
    if (firstUser >= 0) from = firstUser + 1;
  }
  const room = lastUser - from;
  if (room <= 0) return overflow;

  const prev = messages[from - 1];
  const alternates = (k) => {
    const next = messages[from + k];
    return prev && prev.role !== 'system' ? next.role !== prev.role : next.role === 'user';
  };
  const cut = (k) => [...messages.slice(0, from), ...messages.slice(from + k)];
  const counted = new Map();
  const tokensAt = async (k) => {
    if (!counted.has(k)) counted.set(k, await count(cut(k)));
    return counted.get(k);
  };
  // Fewer tokens for every extra message dropped, so the smallest fitting cut is a binary search.
  const smallestFit = async (ks) => {
    if (!ks.length || (await tokensAt(ks[ks.length - 1])) > budget) return null;
    let lo = 0;
    let hi = ks.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((await tokensAt(ks[mid])) <= budget) hi = mid;
      else lo = mid + 1;
    }
    return ks[lo];
  };
  const all = Array.from({ length: room }, (_, i) => i + 1).filter((k) => messages[from + k].role !== 'tool');
  const k = (await smallestFit(all.filter(alternates))) ?? (await smallestFit(all));
  if (k == null) return overflow;
  return { messages: cut(k), tokens: await tokensAt(k) };
}

/**
 * The context-length stop's message, in the panel's setting names. `cut` says the policy drops messages;
 * `reserved` says the request held tokens back for its answer.
 */
function overflowMessage({ tokens, budget, cut, reserved }) {
  const n = (v) => v.toLocaleString('en-US');
  if (cut) {
    const fix = reserved ? 'Raise “Context Size” or lower “Max Output Tokens”' : 'Raise “Context Size”';
    return `The messages this request must keep need more than ${n(budget)} tokens. ${fix}.`;
  }
  const fix = reserved
    ? 'Set “Context Overflow” to “Truncate Middle”, raise “Context Size”, or lower “Max Output Tokens”'
    : 'Set “Context Overflow” to “Truncate Middle”, or raise “Context Size”';
  return `This request needs ${n(tokens)} tokens, and “Context Size” leaves room for ${n(budget)}. ${fix}.`;
}

module.exports = { POLICIES, DEFAULT_POLICY, overflowPolicy, fitMessages, overflowMessage };
