"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useShopStore } from '@/lib/stores/shopStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { db } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import dynamic from 'next/dynamic';

const QRCodeSVG = dynamic(() => import('qrcode.react').then(m => m.QRCodeSVG), { ssr: false });

export default function ShopfrontWithdrawPage() {
  const { user } = useAuthStore();
  const { receivableAmount, currentShop, fetchShopData } = useShopStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    void fetchShopData(user.uid);
  }, [user?.uid, fetchShopData]);

  const payoutLink = useMemo(() => `upi://pay?pa=${encodeURIComponent((currentShop as any)?.upiId || 'example@upi')}&am=${receivableAmount}&tn=Swoop%20Payout`, [currentShop, receivableAmount]);

  const markPaid = async () => {
    if (!user?.uid) return;
    const uid = user.uid;
    // create payout doc
    const ref = doc(collection(db, 'payouts'));
    await setDoc(ref, {
      shopId: uid,
      amount: receivableAmount,
      createdAt: serverTimestamp()
    });
    // reset receivableAmount
    await updateDoc(doc(db, 'shops', uid), { receivableAmount: 0, updatedAt: serverTimestamp() });
    setOpen(false);
  };

  return (
    <div className="container max-w-md mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-quinn">Withdraw Earnings</CardTitle>
          <CardDescription>Current balance: ₹{receivableAmount}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center p-4 bg-white rounded-lg">
            <QRCodeSVG value={payoutLink} size={250} />
          </div>
          <Alert>
            <AlertDescription>
              Scan QR code to receive ₹{receivableAmount} to {(currentShop as any)?.upiId || 'your UPI ID'}
            </AlertDescription>
          </Alert>
          <Button className="w-full" onClick={() => setOpen(true)}>Mark as Paid</Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payout</DialogTitle>
            <DialogDescription>Confirm that you have received ₹{receivableAmount}.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={markPaid}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


