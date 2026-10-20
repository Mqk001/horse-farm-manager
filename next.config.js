/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '64kb' },
    // Intent-prefetched workspace screens stay fresh for only 30 seconds.
    // Ordinary dynamic navigations still fetch current data.
    staleTimes: { dynamic: 0, static: 30 },
  },
};
module.exports = nextConfig;
