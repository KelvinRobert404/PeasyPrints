"use client";

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { ListingCategory, Listing, ListingStatus } from '@/types/models';
import { useCollegeStore } from '@/lib/stores/collegeStore';
import { uploadListingImage } from '@/lib/firebase/storageUpload';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

const CATEGORIES: { id: ListingCategory; label: string }[] = [
  { id: 'student', label: 'Student Listings' },
  { id: 'housing', label: 'Roommates & Housing' },
  { id: 'tickets', label: 'Tickets' },
];

const TAG_CONFIG: Record<ListingCategory, { key: string; label: string }[]> = {
  student: [
    { key: 'negotiable', label: 'Negotiable' },
    { key: 'on_campus_pickup', label: 'On campus pickup' },
    { key: 'good_condition', label: 'Good condition' },
    { key: 'includes_notes', label: 'Includes notes' },
  ],
  housing: [
    { key: 'furnished', label: 'Furnished' },
    { key: 'wifi_included', label: 'WiFi included' },
    { key: 'attached_bath', label: 'Attached bathroom' },
    { key: 'same_gender_only', label: 'Same gender only' },
  ],
  tickets: [
    { key: 'on_campus_event', label: 'On campus event' },
    { key: 'tonight', label: 'Happening tonight' },
    { key: 'transferable', label: 'Transferable' },
    { key: 'group_discount', label: 'Group discount' },
  ],
};

export default function NewListingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { selectedCollege } = useCollegeStore();

  const [category, setCategory] = useState<ListingCategory>('student');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [tagsState, setTagsState] = useState<Record<string, boolean>>({});
  const [whatsappAllowed, setWhatsappAllowed] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [area, setArea] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTags = useMemo(
    () => TAG_CONFIG[category],
    [category]
  );

  const handleTagToggle = (key: string) => {
    setTagsState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(files.slice(0, 3));
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setError('Location not supported on this device');
      return;
    }
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setError('Unable to get current location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      router.push('/login?redirect_url=/marketplace/new');
      return;
    }
    if (!title.trim()) {
      setError('Please add a title');
      return;
    }
    if (!area.trim()) {
      setError('Please add the area/location name');
      return;
    }
    if (!coords) {
      setError('Please set your current location');
      return;
    }

    setSubmitting(true);
    try {
      const priceNumber = price ? Number(price) : undefined;
      if (price && Number.isNaN(priceNumber)) {
        throw new Error('Price must be a number');
      }

      const imageUrls: string[] = [];
      for (const file of images.slice(0, 3)) {
        const url = await uploadListingImage(user.id, file);
        imageUrls.push(url);
      }

      const selectedTags = activeTags
        .filter((t) => tagsState[t.key])
        .map((t) => t.label);

      const status: ListingStatus = 'pending_moderation';

      const payload: Omit<Listing, 'id'> = {
        category,
        status,
        collegeName: selectedCollege,
        title: title.trim(),
        description: description.trim() || undefined,
        price: priceNumber,
        images: imageUrls,
        tags: selectedTags,
        whatsappAllowed,
        whatsappNumber: whatsappAllowed && whatsappNumber.trim() ? whatsappNumber.trim() : undefined,
        createdAt: serverTimestamp() as any,
        authorId: user.id,
        authorName: user.fullName || user.primaryEmailAddress?.emailAddress?.split('@')[0],
        authorVerified: false,
        location: {
          lat: coords.lat,
          lng: coords.lng,
          area: area.trim(),
        },
      };

      const ref = await addDoc(collection(db, 'listings'), payload);
      router.replace(`/marketplace/${ref.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create listing');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 pb-4">
      <header className="px-[5px] pt-3 pb-2">
        <h1 className="text-xl font-semibold font-quinn tracking-wide text-gray-900">new listing</h1>
        <p className="text-[11px] text-gray-500">
          Share something with Kristu Jayanti students
        </p>
      </header>

      <main className="flex-1 overflow-y-auto px-[5px]">
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Category pills */}
            <div className="inline-flex rounded-full bg-gray-100 p-1 w-full">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    'flex-1 rounded-full px-3 py-2 text-[11px] font-medium transition-colors',
                    category === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Title & price */}
            <div className="space-y-2">
              <Input
                placeholder="Title (e.g. 2nd year Economics book)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 text-sm"
              />
              <Input
                placeholder={
                  category === 'housing'
                    ? 'Price (₹ per month)'
                    : category === 'tickets'
                      ? 'Price (₹ per ticket)'
                      : 'Price (₹)'
                }
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-11 text-sm"
                inputMode="numeric"
              />
            </div>

            {/* Description */}
            <div>
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[80px] rounded-md bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <p className="text-[11px] text-gray-500">Details</p>
              <div className="flex flex-wrap gap-1">
                {activeTags.map((tag) => {
                  const active = !!tagsState[tag.key];
                  return (
                    <button
                      key={tag.key}
                      type="button"
                      onClick={() => handleTagToggle(tag.key)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] border text-left',
                        active
                          ? 'bg-emerald-600/90 border-emerald-500 text-white'
                          : 'bg-white border-gray-300 text-gray-700'
                      )}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-gray-500">Location</p>
                <button
                  type="button"
                  onClick={handleUseLocation}
                  className="text-[11px] text-blue-400 underline-offset-2 underline"
                >
                  Use my current location
                </button>
              </div>
              <Input
                placeholder="Area / locality (e.g. Kothanur)"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="h-11 text-sm"
              />
              {coords && (
                <p className="text-[11px] text-emerald-600">
                  Location set
                </p>
              )}
            </div>

            {/* Images */}
            <div className="space-y-1">
              <p className="text-[11px] text-gray-500">Images (up to 3)</p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImagesChange}
                className="block w-full text-[11px] text-gray-600"
              />
              {images.length > 0 && (
                <p className="text-[11px] text-gray-500">
                  {images.length} image{images.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  Allow WhatsApp contact for this listing
                </span>
                <button
                  type="button"
                  onClick={() => setWhatsappAllowed((v) => !v)}
                  className={cn(
                    'w-10 h-6 rounded-full flex items-center px-1 transition-colors',
                    whatsappAllowed ? 'bg-emerald-500' : 'bg-gray-300'
                  )}
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded-full bg-white transform transition-transform',
                      whatsappAllowed ? 'translate-x-4' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
              {whatsappAllowed && (
                <Input
                  placeholder="WhatsApp number (with country code, e.g. 91...)"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="h-11 text-sm"
                />
              )}
            </div>

            {error && (
              <p className="text-[11px] text-red-600">{error}</p>
            )}

            <Button
              type="submit"
              variant="success"
              size="lg"
              className="w-full mt-2"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Creating…' : 'Create listing'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


