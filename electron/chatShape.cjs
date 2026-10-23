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

/**
 * One merged system turn on top, user and assistant turns, and the last message as a user turn, for the
 * router's model. `keepImages` is true when the loaded model has a projector; a system message's images
 * always drop, since its text merges into one string.
 */
function shapeChatBody(body, { modelId, keepImages = false }) {
  const list = Array.isArray(body.messages) ? body.messages : [];
  let droppedImages = 0;
  const shape = (m, keep) => {
    const out = shapeContent(m?.content, keep);
    droppedImages += out.dropped;
    return out.content;
  };
  let system = '';
  const turns = [];
  for (const m of list.slice(0, -1)) {
    if (m?.role === 'system') system += (system ? '\n' : '') + shape(m, false);
    else if (m?.role === 'user' || m?.role === 'assistant') turns.push({ role: m.role, content: shape(m, keepImages) });
  }
  const last = list[list.length - 1];
  turns.push({ role: 'user', content: last ? shape(last, keepImages) : '' });
  const messages = system ? [{ role: 'system', content: system }, ...turns] : turns;
  return { body: { ...body, model: modelId, messages }, droppedImages };
}

module.exports = { shapeChatBody };
