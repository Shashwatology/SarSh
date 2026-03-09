const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { sendNotificationToUser } = require('./notifications');

// Get all messages for a specific chat
router.get('/:chatId', auth, async (req, res) => {
    try {
        const messages = await pool.query(
            `SELECT m.*, 
                    u.username as sender_name, 
                    u.profile_picture as sender_avatar,
                    rm.content as reply_to_content,
                    rm.media_url as reply_to_media_url,
                    rm.media_type as reply_to_media_type,
                    ru.username as reply_to_username,
                    COALESCE(
                        (SELECT json_agg(json_build_object('user_id', mr.user_id, 'reaction', mr.reaction)) 
                         FROM MessageReactions mr WHERE mr.message_id = m.id), 
                        '[]'::json
                    ) as reactions
             FROM Messages m 
             LEFT JOIN Users u ON m.sender_id = u.id 
             LEFT JOIN Messages rm ON m.reply_to_id = rm.id
             LEFT JOIN Users ru ON rm.sender_id = ru.id
             WHERE m.chat_id = $1 ORDER BY m.created_at ASC`,
            [req.params.chatId]
        );
        res.json(messages.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Send a new message
router.post('/', auth, async (req, res) => {
    const { chatId, content, mediaUrl, mediaType, replyToId, isForwarded } = req.body;
    const senderId = req.user.id;

    try {
        const newMessage = await pool.query(
            `WITH inserted_msg AS (
                INSERT INTO Messages (chat_id, sender_id, content, media_url, media_type, reply_to_id, is_forwarded) 
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
            )
            SELECT m.*, 
                   u.username as sender_name, 
                   u.profile_picture as sender_avatar,
                   rm.content as reply_to_content,
                   rm.media_url as reply_to_media_url,
                   rm.media_type as reply_to_media_type,
                   ru.username as reply_to_username
            FROM inserted_msg m 
            LEFT JOIN Users u ON m.sender_id = u.id
            LEFT JOIN Messages rm ON m.reply_to_id = rm.id
            LEFT JOIN Users ru ON rm.sender_id = ru.id`,
            [chatId, senderId, content, mediaUrl, mediaType, replyToId || null, isForwarded || false]
        );

        const savedMessage = newMessage.rows[0];

        // Trigger push notifications for offline participants
        try {
            const participants = await pool.query(
                `SELECT u.id, u.is_online 
                 FROM ChatParticipants cp 
                 JOIN Users u ON cp.user_id = u.id 
                 WHERE cp.chat_id = $1 AND u.id != $2`,
                [chatId, senderId]
            );

            participants.rows.forEach(p => {
                if (!p.is_online) {
                    sendNotificationToUser(p.id, {
                        title: `New message from ${savedMessage.sender_name}`,
                        body: savedMessage.content || 'Media attached',
                        url: `/chats/${chatId}`
                    });
                }
            });
        } catch (pushErr) {
            console.error('Error triggering push notifications:', pushErr);
        }

        res.json(savedMessage);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Forward a message to multiple chats
router.post('/forward', auth, async (req, res) => {
    const { messageId, chatIds } = req.body;
    const senderId = req.user.id;

    try {
        // Fetch original message
        const originalMsg = await pool.query('SELECT * FROM Messages WHERE id = $1', [messageId]);
        if (originalMsg.rows.length === 0) {
            return res.status(404).json({ msg: 'Original message not found' });
        }

        const { content, media_url, media_type } = originalMsg.rows[0];
        const forwardedMessages = [];

        // Insert forwarded message into each chat
        for (const chatId of chatIds) {
            const newMessage = await pool.query(
                `WITH inserted_msg AS (
                    INSERT INTO Messages (chat_id, sender_id, content, media_url, media_type, is_forwarded) 
                    VALUES ($1, $2, $3, $4, $5, true) RETURNING *
                )
                SELECT m.*, u.username as sender_name, u.profile_picture as sender_avatar 
                FROM inserted_msg m 
                LEFT JOIN Users u ON m.sender_id = u.id`,
                [chatId, senderId, content, media_url, media_type]
            );

            const savedMessage = newMessage.rows[0];
            forwardedMessages.push(savedMessage);

            // Trigger push notifications for offline participants
            try {
                const participants = await pool.query(
                    `SELECT u.id, u.is_online 
                     FROM ChatParticipants cp 
                     JOIN Users u ON cp.user_id = u.id 
                     WHERE cp.chat_id = $1 AND u.id != $2`,
                    [chatId, senderId]
                );

                participants.rows.forEach(p => {
                    if (!p.is_online) {
                        sendNotificationToUser(p.id, {
                            title: `Forwarded message from ${savedMessage.sender_name}`,
                            body: savedMessage.content || 'Media attached',
                            url: `/chats/${chatId}`
                        });
                    }
                });
            } catch (pushErr) {
                console.error('Error triggering push notifications:', pushErr);
            }
        }

        res.json(forwardedMessages);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error forwarding message');
    }
});

// Mark messages as read
router.put('/read/:chatId', auth, async (req, res) => {
    try {
        await pool.query(
            "UPDATE Messages SET status = 'read' WHERE chat_id = $1 AND sender_id != $2 AND status != 'read'",
            [req.params.chatId, req.user.id]
        );
        res.json({ msg: 'Messages marked as read' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Edit a message
router.put('/:id/edit', auth, async (req, res) => {
    try {
        const { content } = req.body;
        const messageId = req.params.id;
        const userId = req.user.id;

        // Verify ownership and update
        const updated = await pool.query(
            'UPDATE Messages SET content = $1, is_edited = true WHERE id = $2 AND sender_id = $3 AND is_deleted = false RETURNING *',
            [content, messageId, userId]
        );

        if (updated.rows.length === 0) {
            return res.status(404).json({ msg: 'Message not found or unauthorized' });
        }

        res.json(updated.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error editing message');
    }
});

// Delete a message
router.delete('/:id', auth, async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user.id;

        // Soft delete: clear content and media, set is_deleted flag
        const deleted = await pool.query(
            "UPDATE Messages SET content = 'This message was deleted', media_url = NULL, is_deleted = true WHERE id = $1 AND sender_id = $2 RETURNING *",
            [messageId, userId]
        );

        if (deleted.rows.length === 0) {
            return res.status(404).json({ msg: 'Message not found or unauthorized' });
        }

        res.json(deleted.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error deleting message');
    }
});

// Toggle reaction on a message
router.post('/:id/react', auth, async (req, res) => {
    try {
        const { reaction } = req.body;
        const messageId = req.params.id;
        const userId = req.user.id;

        // Remove reaction if already exists, else add/update
        const existing = await pool.query('SELECT * FROM MessageReactions WHERE message_id = $1 AND user_id = $2', [messageId, userId]);
        if (existing.rows.length > 0 && existing.rows[0].reaction === reaction) {
            await pool.query('DELETE FROM MessageReactions WHERE message_id = $1 AND user_id = $2', [messageId, userId]);
            res.json({ action: 'removed', reaction, messageId, userId });
        } else {
            const upsert = await pool.query(
                `INSERT INTO MessageReactions (message_id, user_id, reaction) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (message_id, user_id) 
                 DO UPDATE SET reaction = EXCLUDED.reaction RETURNING *`,
                [messageId, userId, reaction]
            );
            res.json({ action: 'added', data: upsert.rows[0], messageId, userId });
        }
    } catch (err) {
        console.error('Reaction Error:', err.message);
        res.status(500).send('Server Error adding reaction');
    }
});

// Clear all messages in a chat
router.delete('/clear/:chatId', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { chatId } = req.params;
        const userId = req.user.id;

        // Check if user is a participant of the chat
        const participant = await pool.query(
            'SELECT * FROM ChatParticipants WHERE chat_id = $1 AND user_id = $2',
            [chatId, userId]
        );

        if (participant.rows.length === 0) {
            return res.status(403).json({ msg: 'Unauthorized to clear this chat' });
        }

        await client.query('BEGIN');

        // 1. Clear reply_to_id self-references first to avoid foreign key issues
        await client.query('UPDATE Messages SET reply_to_id = NULL WHERE chat_id = $1', [chatId]);

        // 2. Clear reactions for these messages (even if ON DELETE CASCADE exists, this is safer for bulk)
        await client.query(`
            DELETE FROM MessageReactions 
            WHERE message_id IN (SELECT id FROM Messages WHERE chat_id = $1)
        `, [chatId]);

        // 3. Clear all messages from this chat
        await client.query('DELETE FROM Messages WHERE chat_id = $1', [chatId]);

        await client.query('COMMIT');
        res.json({ msg: 'Chat cleared successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Clear Chat Error:', err.message);
        res.status(500).send('Server Error clearing chat');
    } finally {
        client.release();
    }
});

module.exports = router;
