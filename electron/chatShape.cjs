// Shapes a chat request's messages for llama-server's chat template; fields other than `messages` pass through.

/** A message's content, and how many image parts it dropped. Text parts join unless an image survives. */
function shapeContent(content, keepImages) {
  if (!Array.isArray(content)) return { content: content || '', dropped: 0 };
  const texts = [];
  const parts = [];
  let images = 0;
  let dropped = 0;
  for (const part of content) {
    if (part && part.type === 'text') {
      texts.push(part.text || '');
      parts.push(part);
    } else if (part && part.type === 'image_url') {
      if (keepImages) { parts.push(part); images += 1; } else dropped += 1;
    }
  }
  return { content: images ? parts : texts.join('\n\n'), dropped };
}

const isToolCall = (m) => m?.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0;

/**
 * One merged system turn on top, user and assistant turns, and the last message as a user turn, for the
 * router's model. A conversation with a tool call also keeps its tool turns, `tool_calls` and
 * `reasoning_content`, and a trailing `tool` message stays one. `keepImages` is true when the loaded model
 * has a projector; a system message's images always drop, since its text merges into one string.
 */
function shapeChatBody(body, { modelId, keepImages = false }) {
  const list = Array.isArray(body.messages) ? body.messages : [];
  const withTools = list.some(isToolCall);
  let droppedImages = 0;
  const shape = (m, keep) => {
    const out = shapeContent(m?.content, keep);
    droppedImages += out.dropped;
    return out.content;
  };
  const shapeTurn = (m) => {
    const t = { role: m.role, content: shape(m, keepImages) };
    if (!withTools) return t;
    if (m.role === 'tool') t.tool_call_id = m.tool_call_id;
    if (isToolCall(m)) {
      if (m.content == null) t.content = null;
      t.tool_calls = m.tool_calls;
    }
    if (m.role === 'assistant' && typeof m.reasoning_content === 'string') t.reasoning_content = m.reasoning_content;
    return t;
  };
  const keepsRole = (m) => m?.role === 'user' || m?.role === 'assistant' || (withTools && m?.role === 'tool');
  let system = '';
  const turns = [];
  for (const m of list.slice(0, -1)) {
    if (m?.role === 'system') system += (system ? '\n' : '') + shape(m, false);
    else if (keepsRole(m)) turns.push(shapeTurn(m));
  }
  const last = list[list.length - 1];
  if (withTools && last?.role === 'tool') turns.push(shapeTurn(last));
  else turns.push({ role: 'user', content: last ? shape(last, keepImages) : '' });
  const messages = system ? [{ role: 'system', content: system }, ...turns] : turns;
  return { body: { ...body, model: modelId, messages }, droppedImages };
}

module.exports = { shapeChatBody };
