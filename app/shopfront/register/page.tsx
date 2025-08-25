"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase/config';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { onAuthStateChanged } from 'firebase/auth';

export default function ShopfrontRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Please sign in first');
      let logoUrl: string | undefined = undefined;
      if (logoFile) {
        const objectPath = `shop_logos/${uid}.jpg`;
        const storageRef = ref(storage, objectPath);
        await uploadBytes(storageRef, logoFile, { contentType: logoFile.type || 'image/jpeg' });
        logoUrl = await getDownloadURL(storageRef);
      }
      const timing = `${openingTime} to ${closingTime}`;
      await setDoc(doc(db, 'shops', uid), {
        name, address, phone, email,
        openingTime, closingTime, timing,
        logoUrl,
        receivableAmount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      router.replace('/shopfront/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-quinn">Create Shop</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm">Shop Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Address</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-sm">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm">Opens</label>
                <Input type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-sm">Closes</label>
                <Input type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Logo</label>
              <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full" disabled={loading} type="submit">{loading ? 'Creating...' : 'Create Shop'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


