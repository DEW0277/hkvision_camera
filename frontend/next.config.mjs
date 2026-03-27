/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  async rewrites() {
    return [
      { 
        source: "/face-api/:path*",
        destination: "http://185.74.5.28:4001/:path*",
      },
    ];
  },
};

export default nextConfig;
