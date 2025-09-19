import type { Metadata, Viewport } from 'next';
import './globals.css';
import { assertRequiredEnvInProd } from '@/lib/utils/env';
import localFont from 'next/font/local';
import Script from 'next/script';

const Quinn = localFont({
  src: '../public/fonts/Quinn-Bold.otf',
  weight: '700 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-quinn'
});
import { AuthProvider } from '@/components/providers/AuthProvider';
import { RootShell } from '@/components/layout/RootShell';
import { ClerkProvider } from '@clerk/nextjs';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  title: 'PeasyPrints',
  description: 'Print with ease - web app',
  manifest: '/manifest.json'
};

export const runtime = 'nodejs';

export const viewport: Viewport = {
  themeColor: '#2563eb'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  try { assertRequiredEnvInProd(); } catch (e) { console.error(e); throw e; }
  return (
    <html lang="en">
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-049MSKR11F" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'G-049MSKR11F');
        `}</Script>
        {process.env.NEXT_PUBLIC_POSTHOG_KEY ? (
          <Script id="posthog-init" strategy="beforeInteractive">{`
            !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"};var c="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures debug sendFeatureFlags reloadFeatureFlags".split(" ");for(n=0;n<c.length;n++)g(u,c[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
            posthog.init('${process.env.NEXT_PUBLIC_POSTHOG_KEY}', {
              api_host: '${(process.env.NEXT_PUBLIC_POSTHOG_HOST as string) || '/ingest'}',
              capture_pageview: false,
              mask_all_text: true,
              mask_all_element_attributes: true,
              persistence: 'localStorage+cookie',
              person_profiles: 'identified_only'
            });
          `}</Script>
        ) : null}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="stylesheet" href="https://use.typekit.net/vex5zkw.css" />
      </head>
      <body className={`${Quinn.variable} font-[coolvetica]`}>
        <ClerkProvider
          signInUrl="/login"
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        >
          <RootShell>
            <AuthProvider>
              {children}
            </AuthProvider>
          </RootShell>
        </ClerkProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
