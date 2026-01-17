"use client";

import { useMemo } from 'react';
import Link from 'next/link';

// Material icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-rounded ${className}`}>{name}</span>;
}

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
    <div className="min-h-screen flex flex-col bg-white pb-20">
      {/* Navbar */}
      <div className="bg-blue-600 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-white active:opacity-70">
          <Icon name="arrow_back" className="text-2xl" />
        </Link>
        <h1 className="text-lg font-semibold text-white">Help & Support</h1>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-5">
        {/* Hero */}
        <div className="bg-blue-50 rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <Icon name="support_agent" className="text-xl text-white" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Need help?</p>
              <p className="text-xs text-gray-500">We're here for you</p>
            </div>
          </div>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Icon name="payments" className="text-lg text-blue-600" />
              Payment Issues
            </h3>
            <p className="mt-2 text-xs text-gray-600 leading-relaxed">
              If money gets debited but the order isn't showing up, don't worry. You can safely place a second order—we'll refund the first one. Any amount less than ₹100 will be refunded automatically.
            </p>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Icon name="bug_report" className="text-lg text-blue-600" />
              App or Technical Glitches
            </h3>
            <p className="mt-2 text-xs text-gray-600 leading-relaxed">
              If you run into an error or a page that won't load, just take a screenshot and send it to us. Our team will look into it right away.
            </p>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Icon name="lightbulb" className="text-lg text-blue-600" />
              Feedback & Ideas
            </h3>
            <p className="mt-2 text-xs text-gray-600 leading-relaxed">
              Got suggestions? Think we should add new features? We'd love to hear from you. Every bit of feedback helps us improve Swoop for your campus.
            </p>
          </div>
        </div>

        {/* WhatsApp Button */}
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-600 text-white font-medium active:bg-green-700 transition-colors"
        >
          <Icon name="chat" className="text-xl" />
          Chat on WhatsApp
        </a>
      </main>

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-4 left-4 right-4 max-w-[396px] mx-auto">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 py-3.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30 text-white font-medium active:scale-[0.98] transition-transform"
        >
          <Icon name="home" className="text-xl" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
