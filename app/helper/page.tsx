"use client";

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle2, Printer } from 'lucide-react';

const CURRENT_VERSION = "2.0.0";
const BUILD_DATE = "2025-12-14";

export default function HelperPage() {
  return (
    <div className="container mx-auto max-w-2xl p-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            PeasyPrint Helper
          </CardTitle>
          <CardDescription>
            Version {CURRENT_VERSION} • Build {BUILD_DATE}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-700">
            Install PeasyPrint Helper on your Windows PC to enable one-click printing from the dashboard.
          </p>

          <div className="flex items-center gap-3">
            <Link href="/api/helper/download">
              <Button className="gap-2">
                <Download className="h-4 w-4" />
                Download Helper
              </Button>
            </Link>
            <span className="text-xs text-gray-500">
              Windows 10/11 • Run and follow on-screen steps
            </span>
          </div>

          {/* What's New Section */}
          <div className="rounded-lg bg-green-50 p-4 border border-green-100">
            <h3 className="text-sm font-medium text-green-800 mb-2">What's New in v{CURRENT_VERSION}</h3>
            <ul className="text-xs text-green-700 space-y-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span><strong>Perfect print quality</strong> – Prints at original PDF resolution (no more blurry text)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span><strong>API Base override</strong> – Advanced setting for custom server endpoints</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span><strong>Better stability</strong> – Fixed memory leaks and improved error handling</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span><strong>Debug logging</strong> – Logs saved to %LOCALAPPDATA%\PeasyPrint\logs</span>
              </li>
            </ul>
          </div>

          <div className="text-xs text-gray-600">
            After installation, return to the dashboard and click Print again.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
