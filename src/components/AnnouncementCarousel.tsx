'use client';

import { useEffect, useMemo, useState } from 'react';

type AnnouncementImage = {
  src: string;
  alt?: string;
};

const AUTO_ADVANCE_MS = 3500;

export function AnnouncementCarousel({ heightClass = 'h-24', outerClassName = 'px-[5px] mt-3', backgroundClass = 'bg-neutral-900' }: { heightClass?: string; outerClassName?: string; backgroundClass?: string }) {
  const [images, setImages] = useState<AnnouncementImage[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/announcements', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        const imgs: AnnouncementImage[] = Array.isArray(data?.images) ? data.images : [];
        setImages(imgs);
        setIndex(0);
      })
      .catch(() => {
        if (!isMounted) return;
        setImages([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [images.length]);

  const hasImages = images.length > 0;
  const current = useMemo(() => images[index] ?? null, [images, index]);

  if (!hasImages) {
    return null;
  }

  return (
    <div className={outerClassName}>
      <div className={`relative ${heightClass} w-full overflow-hidden rounded-2xl ${backgroundClass}`}>
        {images.map((img, i) => (
          <img
            key={img.src}
            src={img.src}
            alt={img.alt || 'announcement'}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${i === index ? 'opacity-100' : 'opacity-0'}`}
            draggable={false}
          />)
        )}

        {/* dots */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-2 bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AnnouncementCarousel;


