/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/face-api/:path*",
        destination: "http://213.230.118.15:4001/:path*",
      },
    ];
  },
};

export default nextConfig;
