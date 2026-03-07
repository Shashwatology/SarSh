const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const webpush = require('web-push');
const jwt = require('jsonwebtoken');

// Configure web-push with VAPID keys
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Route to save a push subscription
router.post('/subscribe', authenticateToken, async (req, res) => {
    const { subscription } = req.body;
    const userId = req.user.id;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription object' });
    }

    try {
        // Here we could check if this exact endpoint is already subscribed for this user
        // For simplicity, we just insert it. In a production app you might upsert or delete old ones
        await pool.query(
            'INSERT INTO PushSubscriptions (user_id, subscription) VALUES ($1, $2)',
            [userId, subscription]
        );

        res.status(201).json({ message: 'Subscription saved successfully' });
    } catch (err) {
        console.error('Error saving subscription:', err);
        res.status(500).json({ error: 'Failed to save subscription' });
    }
});

// Helper function to send notification to a specific user (can be imported by other files)
const sendNotificationToUser = async (userId, payload) => {
    try {
        const subscriptions = await pool.query(
            'SELECT * FROM PushSubscriptions WHERE user_id = $1',
            [userId]
        );

        if (subscriptions.rows.length === 0) return;

        const notifications = subscriptions.rows.map(sub => {
            return webpush.sendNotification(sub.subscription, JSON.stringify(payload))
                .catch(err => {
                    console.error('Error sending notification, marking as expired. Error:', err.statusCode);
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        // The subscription has expired or is no longer valid
                        pool.query('DELETE FROM PushSubscriptions WHERE id = $1', [sub.id]);
                    }
                });
        });

        await Promise.allSettled(notifications);
    } catch (err) {
        console.error('Failed to process notifications for user', userId, err);
    }
};

module.exports = { router, sendNotificationToUser };
