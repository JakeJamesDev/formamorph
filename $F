const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/** How loud a message is; the client styles each differently. Describes the message, never an action. */
const SEVERITIES = ['info', 'warning', 'urgent'];

/** Whose name a message is signed with. `team` shows generic branding; `username` names the admin. */
const SENDER_MODES = ['team', 'username'];

/**
 * How far a message reaches and whether it can be cleared — one escalating choice, because pinning
 * something always means everyone gets it.
 *
 * - `existing` — accounts that predate it; dismissible (the default)
 * - `new` — also accounts created later; dismissible (a welcome message)
 * - `pinned` — also accounts created later, and cannot be dismissed (rules, guidelines)
 *
 * A direct message has no audience question, so only `existing` and `pinned` mean anything for one.
 */
const SCOPES = ['existing', 'new', 'pinned'];

// Which rows a user may see: not recalled, not dismissed by them, and either addressed to them or a
// broadcast they qualify for — a broadcast scoped `new`/`pinned` reaches everyone, an `existing` one only
// accounts that already existed when it was sent.
//
// A pinned message ignores `dismissed_at` rather than erasing it, so pinning brings a message back for
// anyone who had cleared it and unpinning restores exactly the state they had.
//
// `datetime()` wraps both timestamps because the two sides are written in different formats: `users` and
// `messages` default to CURRENT_TIMESTAMP ('YYYY-MM-DD HH:MM:SS') while other writers here use
// `toISOString()` ('YYYY-MM-DDTHH:MM:SS.sssZ'). Compared as raw strings 'T' sorts above ' ', so a mixed
// pair orders wrongly.
const VISIBLE_WHERE = `
  m.recalled_at IS NULL
  AND (m.scope = 'pinned' OR s.dismissed_at IS NULL)
  AND (
    m.recipient_id = @userId
    OR (
      m.recipient_id IS NULL
      AND (m.scope IN ('new', 'pinned') OR datetime(m.created_at) >= datetime(u.created_at))
    )
  )
`;

// Pinned messages sit above the ordinary stream; within each group the newest comes first. `id` breaks
// same-second ties so a page can't repeat or skip a row.
const INBOX_ORDER = `
  ORDER BY (CASE WHEN m.scope = 'pinned' THEN 0 ELSE 1 END), datetime(m.created_at) DESC, m.id ASC
`;

// `users u` joins on the caller so the broadcast rule can read their signup date; `su` resolves the
// sender's name for display.
const VISIBLE_FROM = `
  FROM messages m
  JOIN users u ON u.id = @userId
  LEFT JOIN message_states s ON s.message_id = m.id AND s.user_id = @userId
  LEFT JOIN users su ON su.id = m.sender_id
`;

// The admin-facing shape: sender and recipient names resolved, plus whichever receipt the audience
// implies — one recipient's read/dismiss state for a 1:1, a read-of-eligible tally for a broadcast.
const SENT_SELECT = `
  SELECT m.*,
         su.username AS sender_username,
         ru.username AS recipient_username,
         rs.read_at AS recipient_read_at,
         rs.dismissed_at AS recipient_dismissed_at,
         (
           SELECT COUNT(*) FROM message_states x
           WHERE x.message_id = m.id AND x.read_at IS NOT NULL
         ) AS read_count,
         (
           SELECT COUNT(*) FROM users eu
           WHERE m.recipient_id IS NULL
             AND (m.scope IN ('new', 'pinned') OR datetime(eu.created_at) <= datetime(m.created_at))
         ) AS eligible_count
  FROM messages m
  LEFT JOIN users su ON su.id = m.sender_id
  LEFT JOIN users ru ON ru.id = m.recipient_id
  LEFT JOIN message_states rs ON rs.message_id = m.id AND rs.user_id = m.recipient_id
`;

/**
 * Message model — admin-authored notices delivered to one user, several users, or everyone.
 */
const Message = {
  SEVERITIES,
  SENDER_MODES,
  SCOPES,

  /**
   * Insert one message.
   *
   * @param {Object} data - `{ senderId, senderAs, recipientId, subject, body, severity, scope }`.
   *   A null `recipientId` makes it a broadcast.
   * @returns {Object} The created row in the admin-facing shape
   */
  create: (data) => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO messages (id, sender_id, sender_as, recipient_id, subject, body, severity, scope)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.senderId,
      data.senderAs || 'team',
      data.recipientId || null,
      data.subject,
      data.body,
      data.severity || 'info',
      data.scope || 'existing'
    );

    return Message.getSentById(id);
  },

  /**
   * Insert the same message once per recipient, in a single transaction.
   *
   * Multi-select send is N independent 1:1 messages rather than one shared row, so each can be recalled
   * and receipted on its own.
   *
   * @param {Array<string>} recipientIds - Recipient user IDs
   * @param {Object} data - Same fields as `create`, minus `recipientId`
   * @returns {Array<Object>} The created rows
   */
  createForRecipients: (recipientIds, data) => {
    return db.transaction(() => recipientIds.map((recipientId) => Message.create({ ...data, recipientId })))();
  },

  /**
   * Find a message by ID regardless of recall state.
   * @param {string} id - Message ID
   * @returns {Object|null} Message row or undefined if not found
   */
  findById: (id) => {
    return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  },

  /**
   * Find a message by ID in the admin-facing shape, with names and receipts resolved.
   * @param {string} id - Message ID
   * @returns {Object|undefined} Enriched message row, or undefined if not found
   */
  getSentById: (id) => {
    return db.prepare(`${SENT_SELECT} WHERE m.id = @id`).get({ id });
  },

  /**
   * A user's inbox, newest first.
   *
   * @param {string} userId - Reader's user ID
   * @param {Object} [options] - `{ limit }`
   * @returns {Object} `{ messages, total, unread }` — `total` is the visible count before the limit
   */
  getInbox: (userId, options = {}) => {
    const { limit = 50 } = options;

    const messages = db.prepare(`
      SELECT m.id, m.subject, m.body, m.severity, m.scope, m.sender_as, m.recipient_id, m.created_at,
             m.edited_at, su.username AS sender_username, s.read_at
      ${VISIBLE_FROM}
      WHERE ${VISIBLE_WHERE}
      ${INBOX_ORDER}
      LIMIT @limit
    `).all({ userId, limit });

    const { total, unread } = db.prepare(`
      SELECT COUNT(*) AS total, SUM(CASE WHEN s.read_at IS NULL THEN 1 ELSE 0 END) AS unread
      ${VISIBLE_FROM}
      WHERE ${VISIBLE_WHERE}
    `).get({ userId });

    return { messages, total, unread: unread || 0 };
  },

  /**
   * Count a user's unread messages. Backs the main-menu badge, so it stays a single count query.
   * @param {string} userId - Reader's user ID
   * @returns {number} Unread count
   */
  getUnreadCount: (userId) => {
    const row = db.prepare(`
      SELECT COUNT(*) AS unread
      ${VISIBLE_FROM}
      WHERE ${VISIBLE_WHERE} AND s.read_at IS NULL
    `).get({ userId });

    return row ? row.unread : 0;
  },

  /**
   * Whether a message is currently in a user's inbox.
   *
   * Every per-user state write checks this first: without it a caller could mark any message ID read and
   * inflate another message's receipt count with a state row that no visibility rule would ever produce.
   *
   * @param {string} messageId - Message ID
   * @param {string} userId - Reader's user ID
   * @returns {boolean} True if the user can currently see it
   */
  isVisibleTo: (messageId, userId) => {
    const row = db.prepare(`
      SELECT m.id
      ${VISIBLE_FROM}
      WHERE ${VISIBLE_WHERE} AND m.id = @messageId
    `).get({ userId, messageId });

    return Boolean(row);
  },

  /**
   * Mark a message read. Idempotent — a second call keeps the first timestamp.
   * @param {string} messageId - Message ID
   * @param {string} userId - Reader's user ID
   * @returns {string} The effective read timestamp
   */
  markRead: (messageId, userId) => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO message_states (message_id, user_id, read_at)
      VALUES (?, ?, ?)
      ON CONFLICT(message_id, user_id)
      DO UPDATE SET read_at = COALESCE(message_states.read_at, excluded.read_at)
    `).run(messageId, userId, now);

    const row = db.prepare('SELECT read_at FROM message_states WHERE message_id = ? AND user_id = ?')
      .get(messageId, userId);
    return row.read_at;
  },

  /**
   * Dismiss a message for one user, hiding it from their inbox. The row survives, so the admin's receipt
   * view can still distinguish "read then dismissed" from "dismissed unread".
   *
   * @param {string} messageId - Message ID
   * @param {string} userId - Reader's user ID
   * @returns {string} The effective dismissal timestamp
   */
  dismiss: (messageId, userId) => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO message_states (message_id, user_id, dismissed_at)
      VALUES (?, ?, ?)
      ON CONFLICT(message_id, user_id)
      DO UPDATE SET dismissed_at = COALESCE(message_states.dismissed_at, excluded.dismissed_at)
    `).run(messageId, userId, now);

    const row = db.prepare('SELECT dismissed_at FROM message_states WHERE message_id = ? AND user_id = ?')
      .get(messageId, userId);
    return row.dismissed_at;
  },

  /**
   * Edit a sent message in place. Every field an admin may change, including the signature — a second
   * admin fixing someone else's notice can re-sign it. Sender, recipient and send date never change.
   *
   * @param {string} id - Message ID
   * @param {Object} fields - `{ subject, body, severity, scope, senderAs }`
   * @returns {Object} The updated row in the admin-facing shape
   */
  update: (id, fields) => {
    db.prepare(`
      UPDATE messages
      SET subject = ?, body = ?, severity = ?, scope = ?, sender_as = ?, edited_at = ?
      WHERE id = ?
    `).run(
      fields.subject,
      fields.body,
      fields.severity,
      fields.scope,
      fields.senderAs,
      new Date().toISOString(),
      id
    );

    return Message.getSentById(id);
  },

  /**
   * Clear every reader's state for a message, so an edit lands as a fresh delivery.
   *
   * Dropping the rows rather than nulling their columns does both halves at once: read receipts restart
   * from zero against the new text, and anyone who had dismissed it gets it back.
   *
   * @param {string} id - Message ID
   */
  resetReaderState: (id) => {
    db.prepare('DELETE FROM message_states WHERE message_id = ?').run(id);
  },

  /**
   * Recall a message: hidden from every inbox, kept in the database. Idempotent.
   * @param {string} id - Message ID
   * @returns {Object} The updated row
   */
  recall: (id) => {
    db.prepare('UPDATE messages SET recalled_at = ? WHERE id = ? AND recalled_at IS NULL')
      .run(new Date().toISOString(), id);
    return Message.findById(id);
  },

  /**
   * The admin sent list, newest first, including recalled rows.
   *
   * Each row carries its own receipt shape: a 1:1 message reports that one recipient's read/dismiss state,
   * a broadcast reports how many of the users eligible to see it have read it.
   *
   * @param {Object} [options] - `{ page, limit, recipientId, audience }`. `recipientId` narrows to one
   *   user's 1:1 history; `audience` is `direct` (1:1 only) or `broadcast` (broadcasts only), and is
   *   ignored when `recipientId` is given. Omit both to list everything.
   * @returns {Object} `{ messages, count, total }`
   */
  /**
   * How many direct messages each of the given users has been sent. One query for a whole page of the
   * admin table rather than a count per row.
   *
   * Counts what the admin's own history list shows, so the number on the button matches what opening it
   * produces — recalled messages included, since they stay on the sender's side.
   *
   * @param {Array<string>} userIds - Recipient IDs
   * @returns {Map<string, number>} User ID → count; absent means none
   */
  countsByRecipient: (userIds) => {
    if (!userIds || userIds.length === 0) return new Map();

    const placeholders = userIds.map(() => '?').join(', ');
    const rows = db.prepare(`
      SELECT recipient_id, COUNT(*) AS count
      FROM messages
      WHERE recipient_id IN (${placeholders})
      GROUP BY recipient_id
    `).all(...userIds);

    return new Map(rows.map((row) => [row.recipient_id, row.count]));
  },

  getSent: (options = {}) => {
    const { page = 1, limit = 20, recipientId = null, audience = null } = options;
    const offset = (page - 1) * limit;

    // The two live in separate admin surfaces — direct messages under Users, broadcasts under their own
    // tab — so each asks for only its own half. `recipientId` implies direct and wins.
    let filter = '';
    if (recipientId) filter = 'WHERE m.recipient_id = @recipientId';
    else if (audience === 'direct') filter = 'WHERE m.recipient_id IS NOT NULL';
    else if (audience === 'broadcast') filter = 'WHERE m.recipient_id IS NULL';

    // better-sqlite3 rejects named parameters a statement doesn't use, so `recipientId` is only bound
    // when the filter clause that reads it is present.
    const filterParams = recipientId ? { recipientId } : {};
    const params = { limit, offset, ...filterParams };

    const messages = db.prepare(`
      ${SENT_SELECT}
      ${filter}
      ORDER BY datetime(m.created_at) DESC, m.id ASC
      LIMIT @limit OFFSET @offset
    `).all(params);

    const countRow = db.prepare(`SELECT COUNT(*) AS count FROM messages m ${filter}`).get(filterParams);

    return { messages, count: messages.length, total: countRow ? countRow.count : 0 };
  }
};

module.exports = Message;
