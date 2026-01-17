'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { AnnouncementCarousel } from '@/components/AnnouncementCarousel';

// Wise-style List Item Navigation Component - Neutral colors
function NavigationItem({
  href,
  icon,
  title,
  description,
  badge,
  disabled = false,
  onClick,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <div
      className={`
        group flex items-center gap-4 px-4 py-4
        bg-white
        border-b border-gray-100 last:border-b-0
        transition-colors duration-150
        ${disabled ? 'opacity-50' : 'hover:bg-gray-50 active:bg-gray-100'}
      `}
    >
      {/* Icon Container - Neutral gray style */}
      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-200 transition-colors">
        <span className="material-symbols-rounded text-gray-700 text-2xl">
          {icon}
        </span>
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">
            {title}
          </h3>
          {badge && (
            <span className="px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full uppercase tracking-wide">
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5 leading-snug">
          {description}
        </p>
      </div>

      {/* Chevron - Wise style */}
      <span className={`material-symbols-rounded text-gray-300 text-xl transition-all duration-150 ${!disabled && 'group-hover:translate-x-0.5 group-hover:text-gray-500'}`}>
        chevron_right
      </span>
    </div>
  );

  if (disabled && onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  if (disabled) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

// Wise-style Secondary Neutral Button
function QuickActionButton({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="
        inline-flex items-center gap-2 px-4 py-2.5
        bg-white hover:bg-gray-50 active:bg-gray-100
        border border-gray-200 hover:border-gray-300
        rounded-full
        text-sm font-medium text-gray-700
        transition-all duration-150
        shadow-sm
      "
    >
      <span className="material-symbols-rounded text-lg text-gray-500">
        {icon}
      </span>
      {label}
    </Link>
  );
}

// Service definitions
const SERVICES = [
  {
    id: 'print',
    href: '/upload',
    icon: 'print',
    title: 'Print',
    description: 'Documents & assignments',
    enabled: true,
  },
  {
    id: 'marketplace',
    href: '/marketplace',
    icon: 'storefront',
    title: 'Marketplace',
    description: 'Buy & sell with peers',
    enabled: true,
  },
  {
    id: 'canteen',
    href: '/shopfront',
    icon: 'restaurant',
    title: 'Canteen',
    description: 'Food & beverages',
    enabled: false,
    badge: 'Soon',
  },
  {
    id: 'support',
    href: '/contact',
    icon: 'support_agent',
    title: 'Support',
    description: 'Get help anytime',
    enabled: true,
  },
];

// Quick actions
const QUICK_ACTIONS = [
  { id: 'orders', href: '/orders', icon: 'package_2', label: 'Orders' },
  { id: 'profile', href: '/profile', icon: 'person', label: 'Profile' },
  { id: 'help', href: '/contact', icon: 'help', label: 'Help' },
];

export default function IndexPage() {
  function showToast(message: string) {
    try {
      const el = document.createElement('div');
      el.textContent = message;
      el.className =
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg transition-all duration-200 opacity-0';
      document.body.appendChild(el);
      requestAnimationFrame(() => {
        el.classList.remove('opacity-0');
        el.classList.add('opacity-100');
      });
      window.setTimeout(() => {
        el.classList.remove('opacity-100');
        el.classList.add('opacity-0');
        window.setTimeout(() => {
          try {
            el.remove();
          } catch { }
        }, 200);
      }, 1800);
    } catch { }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f7f7]">
      {/* Announcement Carousel - more neutral background */}
      <AnnouncementCarousel
        heightClass="h-40"
        outerClassName="px-4 pt-3"
        backgroundClass="bg-gray-100 rounded-2xl"
      />

      {/* Header - Wise style clean typography */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          What would you like to do?
        </h1>
      </div>

      {/* Services Card - Wise List Item Navigation style */}
      <div className="px-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200/60">
          {SERVICES.map((service) => (
            <NavigationItem
              key={service.id}
              href={service.href}
              icon={service.icon}
              title={service.title}
              description={service.description}
              badge={service.badge}
              disabled={!service.enabled}
              onClick={!service.enabled ? () => showToast('Coming soon') : undefined}
            />
          ))}
        </div>
      </div>

      {/* Quick Actions - Wise Secondary Neutral style */}
      <div className="px-4 pt-5">
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <QuickActionButton
              key={action.id}
              href={action.href}
              icon={action.icon}
              label={action.label}
            />
          ))}
        </div>
      </div>

      {/* Footer - Wise style subtle informational */}
      <div className="mt-auto px-4 pb-5 pt-6">
        <p className="text-center text-sm text-gray-400">
          🎓 Built for students, by students
        </p>
      </div>
    </div>
  );
}
