const nodemailer = require('nodemailer');

// Configure the transporter
const transporter = nodemailer.createTransport({
    // You can also use other services like 'gmail', 'sendgrid', etc.
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Send an OTP to the specified email address.
 * If SMTP credentials are not configured, it will log the OTP to the console instead.
 * @param {string} email - The recipient's email address
 * @param {string} otp - The 6-digit OTP code to send
 */
async function sendOTP(email, otp) {
    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('⚠️ SMTP credentials not found in .env. Logging OTP to console instead.');
        console.log(`\n================================`);
        console.log(`📧 Simulated Email to: ${email}`);
        console.log(`🔐 YOUR SAMPARK OTP IS: ${otp}`);
        console.log(`================================\n`);
        return true;
    }

    try {
        const info = await transporter.sendMail({
            from: `"Sampark Support" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Your Verification Code for Sampark',
            text: `Welcome to Sampark! Your 6-digit verification code is: ${otp}. This code expires in 10 minutes.`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #128C7E;">Welcome to Sampark!</h2>
                <p>Thank you for registering. Please use the following One-Time Password (OTP) to complete your sign-up process:</p>
                <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333;">${otp}</span>
                </div>
                <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
            `
        });
        console.log(`Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Failed to send email:', error);
        throw error;
    }
}

module.exports = {
    sendOTP
};
