"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ShopfrontUpdatesPage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600">
            No updates yet. Check back later.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


