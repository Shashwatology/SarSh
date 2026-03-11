const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// Get all chats for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        c.id as chat_id, 
        c.created_at,
        c.theme,
        c.is_group,
        c.is_couple_mode,
        c.anniversary_date,
        c.group_name,
        c.group_icon,
        -- For 1-on-1 chats, we want the other user's info. For groups, use group name.
        CASE 
          WHEN c.is_group = true THEN c.group_name 
          ELSE u.username 
        END as username,
        CASE 
          WHEN c.is_group = true THEN c.group_icon 
          ELSE u.profile_picture 
        END as profile_picture,
        u.id as other_user_id,
        u.is_online,
        u.last_seen,
        last_msg.content as last_message,
        last_msg.created_at as last_message_time,
        COALESCE(unread.count, 0) as unread_count
      FROM Chats c
      INNER JOIN ChatParticipants cp_me ON c.id = cp_me.chat_id AND cp_me.user_id = $1
      -- Get one other participant for 1-on-1 display info
      LEFT JOIN LATERAL (
        SELECT users.id, users.username, users.profile_picture, users.is_online, users.last_seen
        FROM ChatParticipants cp
        JOIN Users users ON cp.user_id = users.id
        WHERE cp.chat_id = c.id AND cp.user_id != $1
        LIMIT 1
      ) u ON c.is_group = false
      -- Get latest message
      LEFT JOIN LATERAL (
        SELECT content, created_at FROM Messages 
        WHERE chat_id = c.id 
        ORDER BY created_at DESC LIMIT 1
      ) last_msg ON true
      -- Get unread count
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as count FROM Messages 
        WHERE chat_id = c.id AND sender_id != $1 AND status != 'read'
      ) unread ON true
      ORDER BY last_message_time DESC NULLS LAST
    `;

    const chats = await pool.query(query, [userId]);
    res.json(chats.rows);
  } catch (err) {
    console.error('Error in GET /chats:', err.message);
    res.status(500).send('Server Error');
  }
});

// Create a new chat or get existing one (1-on-1 or Group)
router.post('/', auth, async (req, res) => {
  const { recipientId, isGroup, groupName, groupIcon, participantIds } = req.body;
  const userId = req.user.id;

  try {
    if (isGroup) {
      if (!participantIds || participantIds.length < 1) {
        return res.status(400).json({ msg: 'Group chat needs participants' });
      }

      const newChat = await pool.query(
        `INSERT INTO Chats (is_group, group_name, group_icon) VALUES (true, $1, $2) RETURNING *`,
        [groupName || 'New Group', groupIcon || null]
      );

      const chatId = newChat.rows[0].id;

      // Add creator to group
      await pool.query(`INSERT INTO ChatParticipants (chat_id, user_id) VALUES ($1, $2)`, [chatId, userId]);

      // Add all members
      for (const id of participantIds) {
        await pool.query(`INSERT INTO ChatParticipants (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [chatId, id]);
      }

      return res.json(newChat.rows[0]);
    }

    // 1-on-1 logic
    if (userId === recipientId) return res.status(400).json({ msg: 'Cannot chat with yourself' });

    // Check if 1-on-1 already exists using ChatParticipants
    const existingChat = await pool.query(
      `SELECT c.* FROM Chats c
       JOIN ChatParticipants cp1 ON c.id = cp1.chat_id AND cp1.user_id = $1
       JOIN ChatParticipants cp2 ON c.id = cp2.chat_id AND cp2.user_id = $2
       WHERE c.is_group = false`,
      [userId, recipientId]
    );

    if (existingChat.rows.length > 0) {
      return res.json(existingChat.rows[0]);
    }

    // Create new 1-on-1 chat
    const newChat = await pool.query(
      `INSERT INTO Chats (is_group) VALUES (false) RETURNING *` // We no longer strictly need user1_id/user2_id, but the schema still allows it. 
    );
    const chatId = newChat.rows[0].id;

    // Insert participants
    await pool.query(`INSERT INTO ChatParticipants (chat_id, user_id) VALUES ($1, $2)`, [chatId, userId]);
    await pool.query(`INSERT INTO ChatParticipants (chat_id, user_id) VALUES ($1, $2)`, [chatId, recipientId]);

    res.json(newChat.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Update chat theme
router.put('/:id/theme', auth, async (req, res) => {
  try {
    const { theme, isCoupleMode } = req.body;
    const chatId = req.params.id;

    const updated = await pool.query(
      'UPDATE Chats SET theme = $1, is_couple_mode = $2 WHERE id = $3 RETURNING *',
      [theme, isCoupleMode || false, chatId]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ msg: 'Chat not found' });
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error updating theme');
  }
});

// Search users to start new chat
router.get('/users/search', auth, async (req, res) => {
  const { q } = req.query;
  try {
    const users = await pool.query(
      "SELECT id, username, profile_picture, status FROM Users WHERE (username ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1) AND id != $2 LIMIT 10",
      [`%${q}%`, req.user.id]
    );
    res.json(users.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
