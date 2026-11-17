import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  serverExternalPackages: ['@react-pdf/renderer'],
  // Silence workspace root inference warning by pinning tracing root
  outputFileTracingRoot: path.join(process.cwd()),
  poweredByHeader: false,
  async headers() {
    // L'auth passwordless (signInWithOtp) appelle Supabase directement depuis le navigateur
    // (lib/supabaseClient.ts) — son origine doit être autorisée par connect-src, sinon le
    // navigateur bloque la requête silencieusement ("Failed to fetch").
    const supabaseOrigin = (() => {
      try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin; } catch { return null; }
    })();

    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // Next.js injecte des scripts inline (bootstrap) → unsafe-inline requis sans nonce
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          `connect-src 'self' https://autocomplete.clearbit.com${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
          "frame-ancestors 'self'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    ];
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default nextConfig;
