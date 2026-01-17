/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
    return [
      // Proxy Strapi uploads to avoid cross-origin/CORS issues for iframes (PDF/PPT/video)
      {
        source: "/uploads/:path*",
        destination: `${base}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
