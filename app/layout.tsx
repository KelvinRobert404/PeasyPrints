import type { Metadata, Viewport } from 'next';
import './globals.css';
import localFont from 'next/font/local';

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
  return (
    <html lang="en">
      <head>
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
      </body>
    </html>
  );
}
