const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const auth = require('../middleware/auth');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/', auth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No file uploaded' });
        }

        const b64 = Buffer.from(req.file.buffer).toString('base64');
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const uploadResponse = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'image',
            folder: 'chat_app_media'
        });

        res.json({ mediaUrl: uploadResponse.secure_url, mediaType: 'image' });
    } catch (err) {
        console.error('CLOUDINARY UPLOAD ERROR:', err);
        res.status(500).json({ error: 'Server Error during image upload', details: err.message });
    }
});

router.post('/audio', auth, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No audio uploaded' });
        }

        const b64 = Buffer.from(req.file.buffer).toString('base64');
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        // Cloudinary uses resource_type 'video' for audio files
        const uploadResponse = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'video',
            folder: 'chat_app_voice_notes'
        });

        res.json({ mediaUrl: uploadResponse.secure_url, mediaType: 'audio' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error during audio upload');
    }
});

router.post('/document', auth, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No document uploaded' });
        }

        const b64 = Buffer.from(req.file.buffer).toString('base64');
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const uploadResponse = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'raw',
            folder: 'chat_app_documents'
        });

        res.json({ mediaUrl: uploadResponse.secure_url, mediaType: 'document' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error during document upload');
    }
});

router.post('/profile-picture', auth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });

        const b64 = Buffer.from(req.file.buffer).toString('base64');
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const uploadResponse = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'image',
            folder: 'chat_app_profiles'
        });

        const mediaUrl = uploadResponse.secure_url;
        const pool = require('../config/db');

        await pool.query(
            'UPDATE Users SET profile_picture = $1 WHERE id = $2',
            [mediaUrl, req.user.id]
        );

        res.json({ profile_picture: mediaUrl });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error updating profile picture');
    }
});

module.exports = router;
