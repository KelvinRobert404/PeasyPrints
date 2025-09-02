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
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-[428px]">
        <div className="rounded-2xl bg-white shadow border p-6">
          <h1 className="text-2xl font-bold text-gray-900">Contact us</h1>
          <p className="mt-2 text-gray-600 text-sm">
            Have a question about your order or pricing? We are here to help.
          </p>
          <div className="mt-6">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center h-12 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
            >
              Chat on WhatsApp
            </a>
            {!phone && (
              <p className="mt-2 text-[11px] text-gray-500">
                Tip: set NEXT_PUBLIC_WHATSAPP_NUMBER in your env to direct chats to a specific number.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


