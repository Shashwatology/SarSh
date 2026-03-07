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
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
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
    socket.on('call_user', (data) => {
        // data: { userToCall: socket_id or room_id, signalData: offer, from: senderId, name: senderName, isVideoCall: boolean }
        // We broadcast to the specific user's personal room
        io.to(`user_${data.userToCall}`).emit('incoming_call', {
            signal: data.signalData,
            from: data.from,
            name: data.name,
            isVideoCall: data.isVideoCall
        });
    });

    socket.on('answer_call', (data) => {
        // data: { to: caller_user_id, signal: answer }
        io.to(`user_${data.to}`).emit('call_accepted', data.signal);
    });

    socket.on('reject_call', (data) => {
        // data: { to: caller_user_id }
        io.to(`user_${data.to}`).emit('call_rejected');
    });

    socket.on('end_call', (data) => {
        // data: { to: other_user_id }
        io.to(`user_${data.to}`).emit('call_ended');
    });

    socket.on('ice_candidate', (data) => {
        io.to(`user_${data.to}`).emit('ice_candidate', data);
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
