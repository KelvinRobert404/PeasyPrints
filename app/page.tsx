'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { AnnouncementCarousel } from '@/components/AnnouncementCarousel';

// Material Symbol icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-rounded ${className}`}>
      {name}
    </span>
  );
}

// Service cards with brand colors (white + blue-600)
const SERVICES = [
  {
    id: 'print',
    href: '/upload',
    name: 'Print',
    tagline: 'Documents & assignments',
    icon: 'print',
    enabled: true,
  },
  {
    id: 'canteen',
    href: '/shopfront',
    name: 'Canteen',
    tagline: 'Food & beverages',
    icon: 'restaurant',
    enabled: false,
    badge: 'Soon',
  },
  {
    id: 'marketplace',
    href: '/marketplace',
    name: 'Marketplace',
    tagline: 'Buy & sell with peers',
    icon: 'storefront',
    enabled: true,
  },
  {
    id: 'support',
    href: '/contact',
    name: 'Support',
    tagline: 'Get help anytime',
    icon: 'support_agent',
    enabled: true,
  },
];

// Quick actions
const QUICK_ACTIONS = [
  { id: 'orders', href: '/orders', label: 'Orders', icon: 'package_2' },
  { id: 'profile', href: '/profile', label: 'Profile', icon: 'person' },
  { id: 'help', href: '/contact', label: 'Help', icon: 'help' },
];

export default function IndexPage() {
  function showToast(message: string) {
    try {
      const el = document.createElement('div');
      el.textContent = message;
      el.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg transition-all duration-200 opacity-0';
      document.body.appendChild(el);
      requestAnimationFrame(() => {
        el.classList.remove('opacity-0');
        el.classList.add('opacity-100');
      });
      window.setTimeout(() => {
        el.classList.remove('opacity-100');
        el.classList.add('opacity-0');
        window.setTimeout(() => { try { el.remove(); } catch { } }, 200);
      }, 1800);
    } catch { }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* Carousel */}
      <AnnouncementCarousel
        heightClass="h-44"
        outerClassName="px-4 mt-3"
        backgroundClass="bg-blue-50 rounded-xl"
      />

      {/* Header */}
      <div className="px-4 pt-4 pb-1">
        <h1 className="text-lg font-semibold text-gray-900">
          What would you like to do?
        </h1>
      </div>

      {/* Services Grid - Blue accent on white */}
      <div className="px-4 mt-2 grid grid-cols-2 gap-2.5">
        {SERVICES.map((service) => {
          const card = (
            <div
              className={`
                relative flex flex-col p-4 h-[140px]
                bg-white rounded-2xl
                border border-gray-200
                active:border-blue-300 active:bg-blue-50/50 active:scale-[0.98]
                transition-all duration-150
                ${!service.enabled && 'opacity-50'}
              `}
            >
              {/* Badge */}
              {service.badge && (
                <span className="absolute top-3 right-3 text-[10px] font-medium text-blue-600 uppercase tracking-wide">
                  {service.badge}
                </span>
              )}

              {/* Icon in blue circle */}
              <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center">
                <Icon name={service.icon} className="text-white text-xl" />
              </div>

              {/* Text */}
              <div className="mt-auto">
                <h3 className="text-[15px] font-semibold text-gray-900">{service.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{service.tagline}</p>
              </div>
            </div>
          );

          if (service.enabled) {
            return (
              <Link key={service.id} href={service.href} className="block">
                {card}
              </Link>
            );
          }

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => showToast('Coming soon')}
              className="text-left w-full"
            >
              {card}
            </button>
          );
        })}
      </div>

      {/* Quick Actions - Blue outline style */}
      <div className="px-4 mt-4">
        <div className="flex gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className="
                flex-1 flex items-center justify-center gap-1.5 py-3
                bg-white border border-blue-200 rounded-xl
                text-sm font-medium text-blue-600
                active:bg-blue-50 active:scale-[0.98]
                transition-all duration-150
              "
            >
              <Icon name={action.icon} className="text-lg" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Fun Footer */}
      <div className="mt-auto px-4 pb-5 pt-4">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-sm text-blue-600 font-medium">
            🎓 Built for students, by students
          </p>
        </div>
      </div>
    </div>
  );
}
