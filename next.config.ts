import type { NextConfig } from "next";

/**
 * Backend origin, e.g. http://<elastic-ip>:3001. Server-only on purpose: the
 * browser never sees it and never calls it directly. When it is set, the block
 * below proxies /api/* to it.
 */
const API_ORIGIN = process.env.API_ORIGIN;

const nextConfig: NextConfig = {
  /*
   * Same-origin API proxy.
   *
   * The site is served from Vercel over HTTPS; the backend runs on EC2 over
   * plain HTTP. A browser on an HTTPS page cannot fetch an HTTP URL — it is
   * blocked as mixed content — so the browser instead calls this origin's own
   * /api/*, and Next forwards it to the backend server-side, where HTTP is fine.
   * That also means no CORS and no TLS certificate on the box.
   *
   * Returned as an array (the `afterFiles` phase), so any real route handler
   * under app/api/* — the wake/status endpoints, when they land — wins over the
   * proxy, and only unmatched /api/* paths fall through to the backend.
   */
  async rewrites() {
    if (!API_ORIGIN) return [];
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The app ships no cross-origin frames or plugins; lock the obvious
          // vectors without reaching for a full CSP the 3D/inline styles would
          // fight.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
