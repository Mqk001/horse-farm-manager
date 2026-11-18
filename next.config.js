/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '64kb' },
    // Reuse visited pages briefly so returning to Overview does not refetch.
    // Writes, farm switches and logout invalidate the client router cache.
    // Full prefetches keep their existing 30-second maximum lifetime.
    staleTimes: { dynamic: 15, static: 30 },
  },
};
module.exports = nextConfig;
