"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useShopStore } from '@/lib/stores/shopStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, Store, LogOut } from 'lucide-react';
import { db, auth } from '@/lib/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

export default function ShopfrontProfilePage() {
  const { user } = useAuthStore();
  const { currentShop, fetchShopData } = useShopStore();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    void fetchShopData(user.uid);
  }, [user?.uid, fetchShopData]);

  useEffect(() => {
    if (!currentShop) return;
    setName(currentShop.name || '');
    setAddress(currentShop.address || '');
    setEmail((currentShop as any).email || '');
    setPhone((currentShop as any).phone || '');
    setLogoUrl(currentShop.logoUrl);
  }, [currentShop]);

  const handleUpload = async (file: File) => {
    if (!user?.uid) return;
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string;
    const objectName = encodeURIComponent(`shop_logos/${user.uid}.jpg`);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${objectName}`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': `Bearer ${idToken}`
      },
      body: await file.arrayBuffer()
    });
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${objectName}?alt=media`;
    setLogoUrl(publicUrl);
    await updateDoc(doc(db, 'shops', user.uid), { logoUrl: publicUrl });
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'shops', user.uid), { name, address, phone, email });
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => { await auth.signOut(); };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex flex-col items-center space-y-4">
        <Avatar className="h-24 w-24">
          <AvatarImage src={logoUrl} />
          <AvatarFallback><Store className="h-12 w-12" /></AvatarFallback>
        </Avatar>
        <label className="inline-flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" asChild>
            <span><Upload className="h-4 w-4 mr-2" />Upload Logo</span>
          </Button>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }} />
        </label>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Shop Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm">Shop Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Address</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-sm">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSave} className="w-full" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          <Button onClick={logout} variant="destructive" className="w-full"><LogOut className="h-4 w-4 mr-2" />Logout</Button>
        </CardContent>
      </Card>
    </div>
  );
}


