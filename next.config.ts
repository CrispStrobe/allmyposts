/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.bsky.app',
      },
      // This pattern allows images from ANY Mastodon instance.
      // While using a wildcard `**` is not generally recommended for security
      // in high-traffic production apps, it is the most practical solution
      // for a tool designed to connect to any federated server.
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;