"use client";

import { useMemo } from 'react';

export default function ContactPage() {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const text = encodeURIComponent('Hi PeasyPrints team! I need help with my order.');
  const waLink = useMemo(() => {
    if (phone && /\d{8,15}/.test(phone)) {
      return `https://wa.me/${phone}?text=${text}`;
    }
    return `https://wa.me/?text=${text}`;
  }, [phone, text]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-6 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Contact us</h1>
        <p className="mt-2 text-gray-600 text-sm max-w-md">
          Have a question about your order or pricing? We’re here to help.
        </p>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center h-12 px-5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
        >
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}


