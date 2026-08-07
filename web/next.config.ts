import type { NextConfig } from "next";

/**
 * Security headers for the demo.
 *
 * CSP is report-only so it never breaks the demo's inline styles/scripts while
 * still surfacing violations in the browser console — the honest middle ground
 * for a local demo vs a production deployment.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js dev + inline hydration
      "style-src 'self' 'unsafe-inline'", // Tailwind + inline styles
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
