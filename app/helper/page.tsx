"use client";

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function HelperPage() {
  return (
    <div className="container mx-auto max-w-2xl p-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>PeasyPrint Helper</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700">
            Install PeasyPrint Helper on your Windows PC to enable one-click printing from the dashboard.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/api/helper/download">
              <Button>Download Helper</Button>
            </Link>
            <span className="text-xs text-gray-500">Latest installer. Run and follow on-screen steps.</span>
          </div>
          <div className="text-xs text-gray-600">
            After installation, return to the dashboard and click Print again.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


