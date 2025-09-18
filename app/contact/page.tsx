"use client";

import { useMemo } from 'react';

export default function ContactPage() {
  // Hardcoded WhatsApp contact per request
  const phone = '918867224918';
  const text = encodeURIComponent('Hi Swoop, I have an issue with');
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
        <div className="mt-6 space-y-6 max-w-xl">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Having trouble? We’ve got you covered.</h2>
            <p className="mt-1 text-gray-600 text-sm">
              We know tech (and payments) can act up sometimes. Don’t stress—here’s what you should do:
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-gray-900">Payment Issues</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              If money gets debited but the order isn’t showing up in your Order Details page, don’t worry. That means it hasn’t reached the shop. In this case, you can safely place a second order—we’ll refund the amount from the first one. Any amount less than ₹100 will be refunded, so you don’t need to worry about losing money.
            </p>
            <p className="text-gray-500 text-xs italic">
              Note: If the order is visible in your Order Details, it will definitely appear on the shop’s dashboard as well.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-gray-900">App or Technical Glitches</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              If you run into an error, a page that won’t load, or any unexpected issue, just take a screenshot and send it to us. Our team will look into it right away and make it right.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-gray-900">Feedback & New Ideas</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              Got suggestions? Think we should add new features or make something better? We’d love to hear from you. Every bit of feedback helps us improve Swoop for you and your campus.
            </p>
          </div>
        </div>
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


