import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { AuthProvider } from '@/components/providers/AuthProvider';
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
    <html lang="en" className={GeistSans.className}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <ClerkProvider>
          <div className="min-h-screen bg-gray-100 flex justify-center">
            {/* Mobile container - max width 428px, centered on larger screens */}
            <div className="w-full max-w-[428px] bg-white shadow-lg min-h-screen flex flex-col">
              <AuthProvider>
                {children}
              </AuthProvider>
            </div>
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
