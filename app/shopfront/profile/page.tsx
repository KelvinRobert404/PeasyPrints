"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useShopStore } from '@/lib/stores/shopStore';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { ShopPricing, PricingTier } from '@/types/models';
import { Plus, Trash2, Upload, Check } from 'lucide-react';

export default function ShopfrontProfilePage() {
    const { currentShop, fetchShopData, updatePricing } = useShopStore();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    // Profile state
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [timing, setTiming] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);

    // Services pricing (kept separate)
    const [softBinding, setSoftBinding] = useState(0);
    const [spiralBinding, setSpiralBinding] = useState(0);
    const [hardBinding, setHardBinding] = useState(0);
    const [emergency, setEmergency] = useState(0);
    const [afterDark, setAfterDark] = useState(0);

    // Unified Tier Pricing
    const [tiers, setTiers] = useState<PricingTier[]>([
        {
            minPages: 1, maxPages: 10,
            a4: { singleBW: 2, doubleBW: 3, singleColor: 10, doubleColor: 18 },
            a3: { singleBW: 5, doubleBW: 8, singleColor: 20, doubleColor: 35 }
        }
    ]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (u) fetchShopData(u.uid);
        });
        return () => unsub();
    }, [fetchShopData]);

    useEffect(() => {
        if (currentShop) {
            setName(currentShop.name || '');
            setAddress(currentShop.address || '');
            setPhone((currentShop as any).phone || '');
            setTiming(currentShop.timing || '');
            setLogoUrl(currentShop.logoUrl || '');

            if (currentShop.pricing) {
                const p = currentShop.pricing;
                setSoftBinding(p.services.softBinding || 0);
                setSpiralBinding(p.services.spiralBinding || 0);
                setHardBinding(p.services.hardBinding || 0);
                setEmergency(p.services.emergency || 0);
                setAfterDark(p.services.afterDark || 0);

                if (p.tiers && p.tiers.length > 0) {
                    // Start ensuring compatibility with new structure if old data exists
                    setTiers(p.tiers.map(t => ({
                        minPages: t.minPages,
                        maxPages: t.maxPages,
                        a4: t.a4 || { singleBW: 0, doubleBW: 0, singleColor: 0, doubleColor: 0 },
                        a3: t.a3 || { singleBW: 0, doubleBW: 0, singleColor: 0, doubleColor: 0 }
                    })));
                }
            }
        }
    }, [currentShop]);

    const handleLogoUpload = async (file: File) => {
        if (!user?.uid) return;
        setLogoFile(file);

        try {
            setLoading(true);
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
        } catch (error) {
            console.error('Logo upload failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const addTier = () => {
        const lastTier = tiers[tiers.length - 1];
        const newMin = lastTier ? lastTier.maxPages + 1 : 1;
        const newMax = newMin + 9;
        setTiers([...tiers, {
            minPages: newMin,
            maxPages: newMax,
            a4: { singleBW: 0, doubleBW: 0, singleColor: 0, doubleColor: 0 },
            a3: { singleBW: 0, doubleBW: 0, singleColor: 0, doubleColor: 0 }
        }]);
    };

    const removeTier = (index: number) => {
        setTiers(tiers.filter((_, i) => i !== index));
    };

    const updateTierRange = (index: number, field: 'minPages' | 'maxPages', value: number) => {
        const updated = [...tiers];
        updated[index] = { ...updated[index], [field]: value };
        setTiers(updated);
    };

    const updateTierPrice = (index: number, section: 'a4' | 'a3', field: string, value: number) => {
        const updated = [...tiers];
        updated[index] = {
            ...updated[index],
            [section]: {
                ...updated[index][section],
                [field]: value
            }
        };
        setTiers(updated);
    };

    const handleSave = async () => {
        if (!user?.uid || !currentShop) return;

        try {
            setLoading(true);

            // Update shop profile
            const shopRef = doc(db, 'shops', user.uid);
            await updateDoc(shopRef, {
                name,
                address,
                phone,
                timing,
                logoUrl,
                updatedAt: serverTimestamp()
            });

            // Update pricing
            const pricing: ShopPricing = {
                // Keep legecy fields empty or with defaults if needed, but tiers are main
                services: {
                    softBinding: Number(softBinding),
                    spiralBinding: Number(spiralBinding),
                    hardBinding: Number(hardBinding),
                    emergency: Number(emergency),
                    afterDark: Number(afterDark),
                },
                tiers: tiers,
            };

            await updatePricing(pricing);

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Save failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 py-6">
            <div className="max-w-6xl mx-auto space-y-6 px-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Shop Profile</h1>
                        <p className="text-sm text-gray-500">Manage details & unified pricing</p>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-9"
                    >
                        {saved ? (
                            <>
                                <Check className="h-4 w-4 mr-2" />
                                Saved
                            </>
                        ) : (
                            <>Save Changes</>
                        )}
                    </Button>
                </div>

                {/* Shop Info & Logo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                            <div className="p-1 rounded bg-blue-50">
                                <Upload className="h-3 w-3 text-blue-600" />
                            </div>
                            Details
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Shop Name</label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" placeholder="Shop Name" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Phone</label>
                                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-sm" placeholder="Phone" />
                            </div>
                            <div className="sm:col-span-2 space-y-1">
                                <label className="text-xs font-medium text-gray-500">Address</label>
                                <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-8 text-sm" placeholder="Address" />
                            </div>
                            <div className="sm:col-span-2 space-y-1">
                                <label className="text-xs font-medium text-gray-500">Timing</label>
                                <Input value={timing} onChange={(e) => setTiming(e.target.value)} className="h-8 text-sm" placeholder="e.g. 9 AM - 9 PM" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="relative group">
                            {logoUrl ? (
                                <img src={logoUrl} alt="Shop logo" className="h-20 w-20 object-cover rounded-full border border-gray-200" />
                            ) : (
                                <div className="h-20 w-20 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400">
                                    <Upload className="h-8 w-8 opacity-50" />
                                </div>
                            )}
                            <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer text-xs font-medium">
                                Change
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                            </label>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">Shop Logo</p>
                            <p className="text-[10px] text-gray-500">Click image to update</p>
                        </div>
                    </div>
                </div>

                {/* Services Section (Horizontal) */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
                    <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                        <div className="p-1 rounded bg-orange-50">
                            <span className="text-orange-500 text-xs">🛠️</span>
                        </div>
                        Services
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Soft Bind</label>
                            <Input type="number" className="h-8 text-xs px-2" value={softBinding} onChange={(e) => setSoftBinding(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Spiral</label>
                            <Input type="number" className="h-8 text-xs px-2" value={spiralBinding} onChange={(e) => setSpiralBinding(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Hard Bind</label>
                            <Input type="number" className="h-8 text-xs px-2" value={hardBinding} onChange={(e) => setHardBinding(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Emergency</label>
                            <Input type="number" className="h-8 text-xs px-2" value={emergency} onChange={(e) => setEmergency(Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">After Dark</label>
                            <Input type="number" className="h-8 text-xs px-2" value={afterDark} onChange={(e) => setAfterDark(Number(e.target.value))} />
                        </div>
                    </div>
                </div>

                {/* Master Pricing Table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <div className="p-1 rounded bg-green-50">
                                <span className="text-green-600 text-xs">₹</span>
                            </div>
                            Master Pricing Table
                        </h2>
                    </div>

                    <div className="overflow-x-auto pb-4">
                        <div className="min-w-[900px]">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-bold text-gray-500 bg-gray-50 p-2 rounded-t-lg items-center text-center">
                                <div className="col-span-2 grid grid-cols-2 gap-1 text-gray-800">
                                    <span>Min Pg</span>
                                    <span>Max Pg</span>
                                </div>
                                <div className="col-span-4 grid grid-cols-4 gap-1 border-l border-r border-gray-200 px-1">
                                    <span className="col-span-4 text-center border-b border-gray-200 pb-1 mb-1 bg-blue-50/50 rounded">A4 Prices</span>
                                    <span>BW 1S</span>
                                    <span>BW 2S</span>
                                    <span>Col 1S</span>
                                    <span>Col 2S</span>
                                </div>
                                <div className="col-span-4 grid grid-cols-4 gap-1 border-r border-gray-200 px-1">
                                    <span className="col-span-4 text-center border-b border-gray-200 pb-1 mb-1 bg-purple-50/50 rounded">A3 Prices</span>
                                    <span>BW 1S</span>
                                    <span>BW 2S</span>
                                    <span>Col 1S</span>
                                    <span>Col 2S</span>
                                </div>
                                <div className="col-span-2">Action</div>
                            </div>

                            {/* Table Body */}
                            <div className="space-y-1 pt-2">
                                {tiers.map((tier, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-2 p-2 hover:bg-gray-50 rounded-lg items-center transition-colors">

                                        {/* Page Range */}
                                        <div className="col-span-2 grid grid-cols-2 gap-1">
                                            <Input
                                                type="number" className="h-7 text-xs px-1 text-center"
                                                value={tier.minPages} onChange={(e) => updateTierRange(index, 'minPages', Number(e.target.value))}
                                            />
                                            <Input
                                                type="number" className="h-7 text-xs px-1 text-center"
                                                value={tier.maxPages} onChange={(e) => updateTierRange(index, 'maxPages', Number(e.target.value))}
                                            />
                                        </div>

                                        {/* A4 Prices */}
                                        <div className="col-span-4 grid grid-cols-4 gap-1 border-l border-r border-gray-200 px-2">
                                            <Input type="number" step="0.1" className="h-7 text-xs px-1 text-center" value={tier.a4.singleBW} onChange={(e) => updateTierPrice(index, 'a4', 'singleBW', Number(e.target.value))} />
                                            <Input type="number" step="0.1" className="h-7 text-xs px-1 text-center" value={tier.a4.doubleBW} onChange={(e) => updateTierPrice(index, 'a4', 'doubleBW', Number(e.target.value))} />
                                            <Input type="number" step="0.1" className="h-7 text-xs px-1 text-center" value={tier.a4.singleColor} onChange={(e) => updateTierPrice(index, 'a4', 'singleColor', Number(e.target.value))} />
                                            <Input type="number" step="0.1" className="h-7 text-xs px-1 text-center" value={tier.a4.doubleColor} onChange={(e) => updateTierPrice(index, 'a4', 'doubleColor', Number(e.target.value))} />
                                        </div>

                                        {/* A3 Prices */}
                                        <div className="col-span-4 grid grid-cols-4 gap-1 border-r border-gray-200 px-2">
                                            <Input type="number" step="0.1" className="h-7 text-xs px-1 text-center" value={tier.a3.singleBW} onChange={(e) => updateTierPrice(index, 'a3', 'singleBW', Number(e.target.value))} />
                                            <Input type="number" step="0.1" className="h-7 text-xs px-1 text-center" value={tier.a3.doubleBW} onChange={(e) => updateTierPrice(index, 'a3', 'doubleBW', Number(e.target.value))} />
                                            <Input type="number" step="0.1" className="h-7 text-xs px-1 text-center" value={tier.a3.singleColor} onChange={(e) => updateTierPrice(index, 'a3', 'singleColor', Number(e.target.value))} />
                                            <Input type="number" step="0.1" className="h-7 text-xs px-1 text-center" value={tier.a3.doubleColor} onChange={(e) => updateTierPrice(index, 'a3', 'doubleColor', Number(e.target.value))} />
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-2 text-center flex justify-center">
                                            <button
                                                onClick={() => removeTier(index)}
                                                className="flex items-center justify-center h-7 w-7 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                                title="Remove Tier"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <Button variant="ghost" size="sm" onClick={addTier} className="w-full h-8 text-xs border border-dashed border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50">
                        <Plus className="h-3 w-3 mr-1" /> Add New Tier
                    </Button>
                </div>
            </div>
        </div>
    );
}
