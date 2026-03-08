const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/db');

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')
    : ['https://sarsh.vercel.app', 'http://localhost:3000'];

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes setup will go here later
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/upload');
const { router: notificationsRoutes } = require('./routes/notifications');

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationsRoutes);

// Store online users: socket.id -> user.id mapping
const onlineUsers = new Map();

// Socket.io Real-time Event Handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Authenticate socket via query params or a dedicated event
    socket.on('setup', async (userId) => {
        onlineUsers.set(socket.id, userId);
        socket.join(`user_${userId}`);
        try {
            await db.query('UPDATE Users SET is_online = true WHERE id = $1', [userId]);
            // Notify everyone that I am online
            socket.broadcast.emit('presence_update', { userId, isOnline: true });
            console.log(`User ${userId} is now online`);
        } catch (e) { console.error('Error updating presence', e); }
    });

    // New event for focus/blur tracking
    socket.on('update_presence', async (data) => {
        const { userId, isOnline } = data;
        try {
            const status = isOnline ? true : false;
            await db.query('UPDATE Users SET is_online = $1, last_seen = NOW() WHERE id = $2', [status, userId]);
            socket.broadcast.emit('presence_update', { userId, isOnline: status, lastSeen: new Date().toISOString() });
            console.log(`User ${userId} presence updated to: ${isOnline ? 'Active' : 'Away'}`);
        } catch (e) { console.error('Error updating status presence', e); }
    });

    socket.on('join_room', (chatId) => {
        socket.join(chatId);
        console.log(`Socket ${socket.id} joined room ${chatId}`);
    });

    socket.on('send_message', async (data) => {
        // broadcast to everyone in room including sender
        io.to(String(data.chat_id)).emit('receive_message', data);

        // Notify all participants globally so their ChatList updates
        try {
            const participants = await db.query('SELECT user_id FROM ChatParticipants WHERE chat_id = $1', [data.chat_id]);
            for (const row of participants.rows) {
                // We emit to the personal room of the participant
                io.to(`user_${row.user_id}`).emit('new_message_notification', data);
            }
        } catch (err) {
            console.error('Error fetching participants for notification', err);
        }
    });

    socket.on('typing', (data) => {
        socket.to(data.chatId).emit('typing', data);
    });

    socket.on('read_receipt', (data) => {
        // Just broadcast for instant UI update
        socket.to(data.chatId).emit('read_receipt', data);
    });

    socket.on('edit_message', (data) => {
        io.to(String(data.chat_id)).emit('update_message', data);
    });

    socket.on('delete_message', (data) => {
        io.to(String(data.chat_id)).emit('update_message', data);
    });

    socket.on('change_theme', (data) => {
        io.to(String(data.chatId)).emit('update_theme', { theme: data.theme });
    });

    socket.on('message_reaction', (data) => {
        io.to(String(data.chatId)).emit('message_reaction', data);
    });

    // WebRTC Signaling Events
    socket.on('call_user', async (data) => {
        // data: { userToCall: socket_id or room_id, signalData: offer, from: senderId, name: senderName, isVideoCall: boolean, chatId: string|number }
        // We broadcast to the specific user's personal room
        io.to(`user_${data.userToCall}`).emit('incoming_call', {
            signal: data.signalData,
            from: data.from,
            name: data.name,
            isVideoCall: data.isVideoCall,
            chatId: data.chatId
        });

        // Trigger push notification if the user is not focused/active
        try {
            const userCheck = await db.query('SELECT is_online FROM Users WHERE id = $1', [data.userToCall]);
            if (userCheck.rows.length > 0 && !userCheck.rows[0].is_online) {
                const notifications = require('./routes/notifications');
                notifications.sendNotificationToUser(data.userToCall, {
                    title: `Incoming ${data.isVideoCall ? 'Video' : 'Audio'} Call`,
                    body: `${data.name} is calling you`,
                    url: '/chats'
                });
            }
        } catch (pushErr) {
            console.error('Error triggering push notification for call:', pushErr);
        }
    });

    socket.on('answer_call', (data) => {
        // data: { to: caller_user_id, signal: answer }
        io.to(`user_${data.to}`).emit('call_accepted', data.signal);
    });

    socket.on('reject_call', async (data) => {
        // data: { to: caller_user_id, reason?: 'busy', chatId: ..., isVideoCall: ... }
        io.to(`user_${data.to}`).emit('call_rejected', data);

        if (data.chatId && data.to) {
            try {
                const msg = data.reason === 'busy' ? (data.isVideoCall ? '📞 User busy (Video)' : '📞 User busy (Audio)') : (data.isVideoCall ? '📞 Missed Video Call' : '📞 Missed Audio Call');
                const res = await db.query(
                    `INSERT INTO Messages (chat_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *`,
                    [data.chatId, data.to, msg]
                );
                io.to(String(data.chatId)).emit('receive_message', res.rows[0]);
            } catch (e) {
                console.error('Failed to log rejected call', e);
            }
        }
    });

    socket.on('end_call', async (data) => {
        // data: { to: other_user_id, chatId: ..., isVideoCall: ... }
        io.to(`user_${data.to}`).emit('call_ended');

        if (data.chatId) {
            try {
                // Find sender_id from the socket if we want the current user, or just hardcode the participant
                // Since data.to is the OTHER user, the sender of this message should conceptually be the one who ended the call
                const userId = onlineUsers.get(socket.id);
                if (userId) {
                    const msg = data.isVideoCall ? '📞 Video Call Ended' : '📞 Audio Call Ended';
                    const res = await db.query(
                        `INSERT INTO Messages (chat_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *`,
                        [data.chatId, userId, msg]
                    );
                    io.to(String(data.chatId)).emit('receive_message', res.rows[0]);
                }
            } catch (e) {
                console.error('Failed to log ended call', e);
            }
        }
    });

    socket.on('ice_candidate', (data) => {
        io.to(`user_${data.to}`).emit('ice_candidate', data);
    });

    // Collaborative Canvas Events
    socket.on('start_drawing', (data) => {
        io.to(String(data.chatId)).emit('start_drawing', data);
    });

    socket.on('drawing_path', (data) => {
        socket.to(String(data.chatId)).emit('drawing_path', data);
    });

    socket.on('clear_canvas', (data) => {
        io.to(String(data.chatId)).emit('clear_canvas', data);
    });

    socket.on('end_drawing', (data) => {
        io.to(String(data.chatId)).emit('end_drawing', data);
    });

    socket.on('draw_grid', (data) => {
        socket.to(String(data.chatId)).emit('draw_grid', data);
    });

    // Handle message delivery ACK
    socket.on('message_delivered', async (data) => {
        try {
            await db.query("UPDATE Messages SET status = 'delivered' WHERE id = $1 AND status = 'sent'", [data.messageId]);
            io.to(data.chatId).emit('message_status_update', { messageId: data.messageId, status: 'delivered', chatId: data.chatId });
        } catch (e) { console.error('Delivery ack error', e); }
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        const userId = onlineUsers.get(socket.id);
        if (userId) {
            onlineUsers.delete(socket.id);
            try {
                await db.query('UPDATE Users SET is_online = false, last_seen = NOW() WHERE id = $1', [userId]);
                socket.broadcast.emit('presence_update', { userId, isOnline: false, lastSeen: new Date().toISOString() });
            } catch (e) { console.error('Error updating presence', e); }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
