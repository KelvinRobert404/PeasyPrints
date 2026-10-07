import type { Metadata, Viewport } from 'next';
import './globals.css';
import { assertRequiredEnvInProd } from '@/lib/utils/env';
import localFont from 'next/font/local';
import { Anton, DM_Sans } from 'next/font/google';

const poster = Anton({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-poster'
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-dm-sans'
});

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
import { AnalyticsConsent } from '@/components/privacy/AnalyticsConsent';
import { AgentationDevTools } from '../components/dev/AgentationDevTools';

export const metadata: Metadata = {
  title: 'PeasyPrints',
  description: 'Print with ease - web app',
  manifest: '/manifest.json'
};

export const runtime = 'nodejs';

export const viewport: Viewport = {
  themeColor: '#f8fafc',
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  try { assertRequiredEnvInProd(); } catch (e) { console.error(e); throw e; }
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link href="https://fonts.cdnfonts.com/css/coolvetica" rel="stylesheet" />
      </head>
      <body className={`${Quinn.variable} ${poster.variable} ${dmSans.variable} font-sans antialiased text-black`}>
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
        <AnalyticsConsent />
        <AgentationDevTools />
      </body>
    </html>
  );
}
