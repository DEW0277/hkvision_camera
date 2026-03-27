/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/face-api/:path*",
        destination: "http://192.168.100.14:4001/:path*",
      },
    ];
  },
};

export default nextConfig;
