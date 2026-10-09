import type { Metadata, Viewport } from 'next';
import './globals.css';
import { assertRequiredEnvInProd } from '@/lib/utils/env';
import { Archivo, Bricolage_Grotesque, Figtree } from 'next/font/google';

// Swoop design system v1: Bricolage (headings), Figtree (body), Archivo Black Italic (logo only).
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['wdth', 'opsz'],
  display: 'swap',
  variable: '--font-bricolage'
});

const figtree = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-figtree'
});

const archivo = Archivo({
  subsets: ['latin'],
  style: ['italic'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo'
});
import { AuthProvider } from '@/components/providers/AuthProvider';
import { RootShell } from '@/components/layout/RootShell';
import { ClerkProvider } from '@clerk/nextjs';
import { AnalyticsConsent } from '@/components/privacy/AnalyticsConsent';
import { AgentationDevTools } from '../components/dev/AgentationDevTools';

export const metadata: Metadata = {
  title: 'Swoop',
  description: 'Print, buy, sell and find a place to stay: your campus, sorted.',
  manifest: '/manifest.json'
};

export const runtime = 'nodejs';

export const viewport: Viewport = {
  themeColor: '#ffffff',
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
      </head>
      <body className={`${bricolage.variable} ${figtree.variable} ${archivo.variable} font-sans antialiased text-ink`}>
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
