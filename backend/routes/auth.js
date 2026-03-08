const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const auth = require('../middleware/auth');

router.post('/register', async (req, res) => {
    const { username, phone, email, password } = req.body;

    try {
        const userExists = await pool.query(
            'SELECT id FROM Users WHERE username = $1 OR phone = $2 OR email = $3',
            [username, phone, email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            'INSERT INTO Users (username, phone, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, username, phone, email, profile_picture',
            [username, phone, email, password_hash]
        );

        const payload = { user: { id: newUser.rows[0].id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

        res.json({ token, user: newUser.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.post('/login', async (req, res) => {
    const { loginId, password } = req.body; // loginId can be phone or email or username

    try {
        const userQuery = await pool.query(
            'SELECT * FROM Users WHERE email = $1 OR phone = $1 OR username = $1',
            [loginId]
        );

        if (userQuery.rows.length === 0) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const user = userQuery.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const payload = { user: { id: user.id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

        delete user.password_hash;
        res.json({ token, user });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await pool.query('SELECT id, username, phone, email, profile_picture, status FROM Users WHERE id = $1', [req.user.id]);
        res.json(user.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.put('/profile', auth, async (req, res) => {
    const { username, status } = req.body;
    try {
        const result = await pool.query(
            'UPDATE Users SET username = COALESCE($1, username), status = COALESCE($2, status) WHERE id = $3 RETURNING id, username, phone, email, profile_picture, status',
            [username, status, req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
