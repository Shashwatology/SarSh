const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { sendNotificationToUser } = require('./notifications');
const ogs = require('open-graph-scraper');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Helper to extract first URL from text
const extractUrl = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
};

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY || 'AIzaSy_demo_key');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
             WHERE m.chat_id = $1 
             AND (m.expires_at IS NULL OR m.expires_at > NOW())
             ORDER BY m.created_at ASC`,
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
    const { chatId, content, mediaUrl, mediaType, replyToId, isForwarded, pollData, expiresAt, isSecret } = req.body;
    const senderId = req.user.id;

    let linkPreview = null;
    if (content) {
        const url = extractUrl(content);
        if (url) {
            try {
                const { result } = await ogs({ url });
                if (result.success) {
                    linkPreview = {
                        title: result.ogTitle || result.twitterTitle,
                        description: result.ogDescription || result.twitterDescription,
                        image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url,
                        siteName: result.ogSiteName || result.twitterSiteName,
                        url: url
                    };
                }
            } catch (ogsErr) {
                console.error('Link preview fetch error:', ogsErr.message);
            }
        }
    }

    try {
        const newMessage = await pool.query(
            `WITH inserted_msg AS (
                INSERT INTO Messages (chat_id, sender_id, content, media_url, media_type, reply_to_id, is_forwarded, link_preview, poll_data, expires_at, is_secret) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
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
            [chatId, senderId, content, mediaUrl, mediaType, replyToId || null, isForwarded || false, linkPreview ? JSON.stringify(linkPreview) : null, pollData ? JSON.stringify(pollData) : null, expiresAt || null, isSecret || false]
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

        // 1. Try to clear reactions (wrap in try-catch in case table doesn't exist yet)
        try {
            await client.query(
                'DELETE FROM MessageReactions WHERE message_id IN (SELECT id FROM Messages WHERE chat_id = $1)',
                [chatId]
            );
            console.log('Reactions cleared for chat:', chatId);
        } catch (reacErr) {
            console.warn('Could not clear MessageReactions (might not exist):', reacErr.message);
        }

        // 2. Clear reply_to_id self-references to avoid circular dependencies during bulk delete
        await client.query('UPDATE Messages SET reply_to_id = NULL WHERE chat_id = $1', [chatId]);

        // 3. Delete all messages from this chat
        // We do this in a single query since we've already unlinked replies
        const deleteResult = await client.query('DELETE FROM Messages WHERE chat_id = $1', [chatId]);

        await client.query('COMMIT');
        console.log(`Successfully cleared ${deleteResult.rowCount} messages from chat ${chatId}`);
        res.json({ msg: 'Chat cleared successfully', count: deleteResult.rowCount });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('CRITICAL Clear Chat Error:', err);
        res.status(500).json({ 
            msg: 'Failed to clear chat', 
            error: err.message,
            detail: err.detail,
            hint: 'This usually happens if there are remaining message dependencies.'
        });
    } finally {
        if (client) client.release();
    }
});

// AI Chat Summarization
router.post('/summarize/:chatId', auth, async (req, res) => {
    try {
        if (!process.env.GOOGLE_AI_KEY || process.env.GOOGLE_AI_KEY.includes('demo')) {
            return res.status(400).json({ 
                msg: 'AI Summarization key missing', 
                error: 'Please add a valid GOOGLE_AI_KEY to your environment variables.' 
            });
        }

        const { chatId } = req.params;
        // Fetch last 50 messages
        const messages = await pool.query(
            `SELECT u.username, m.content, m.created_at 
             FROM Messages m 
             JOIN Users u ON m.sender_id = u.id 
             WHERE m.chat_id = $1 AND m.content != '' 
             ORDER BY m.created_at DESC LIMIT 50`,
            [chatId]
        );

        if (messages.rows.length === 0) {
            return res.json({ summary: "No messages to summarize yet!" });
        }

        const chatHistory = messages.rows.reverse().map(m => `${m.username}: ${m.content}`).join('\n');
        
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
        const modelInstance = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Summarize the following chat history concisely in bullet points. Focus on key decisions, topics, and actions:\n\n${chatHistory}`;
        
        const result = await modelInstance.generateContent(prompt);
        const summary = result.response.text();

        res.json({ summary });
    } catch (err) {
        console.error('Summarization error:', err);
        res.status(500).json({ msg: 'AI Summarization failed', error: err.message });
    }
});

// Vote in a Poll
router.put('/:id/vote', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { optionIndex } = req.body;
        const userId = req.user.id;

        const message = await pool.query('SELECT poll_data FROM Messages WHERE id = $1', [id]);
        if (message.rows.length === 0 || !message.rows[0].poll_data) {
            return res.status(404).json({ msg: 'Poll not found' });
        }

        let pollData = message.rows[0].poll_data;
        // pollData structure: { question, options: [{text, votes: [userIds]}] }
        
        // Remove user's previous vote if any
        pollData.options.forEach(opt => {
            opt.votes = opt.votes.filter(uid => uid !== userId);
        });

        // Add new vote
        if (optionIndex !== null && optionIndex >= 0 && optionIndex < pollData.options.length) {
            pollData.options[optionIndex].votes.push(userId);
        }

        const updated = await pool.query(
            'UPDATE Messages SET poll_data = $1 WHERE id = $2 RETURNING *',
            [JSON.stringify(pollData), id]
        );

        res.json(updated.rows[0]);
    } catch (err) {
        console.error('Poll vote error:', err);
        res.status(500).json({ msg: 'Failed to vote' });
    }
});

module.exports = router;
