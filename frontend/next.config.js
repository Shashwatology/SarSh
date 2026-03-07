const isDev = process.env.NODE_ENV !== 'production';

const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    customWorkerDir: 'worker',
    disable: isDev
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
            },
        ]
    },
    experimental: {
        turbopack: {}
    }
};

module.exports = isDev ? nextConfig : withPWA(nextConfig);
