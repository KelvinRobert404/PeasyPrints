'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { AnnouncementCarousel } from '@/components/AnnouncementCarousel';

// Service card for the 2x2 grid
function ServiceCard({
  href,
  icon,
  title,
  description,
  tintColor,
  iconColor,
  badge,
  disabled = false,
  onClick,
  staggerClass = '',
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  tintColor: string;
  iconColor: string;
  badge?: string;
  disabled?: boolean;
  onClick?: () => void;
  staggerClass?: string;
}) {
  const content = (
    <div
      className={`
        animate-fade-up ${staggerClass}
        group relative flex flex-col gap-3 p-4
        bg-white rounded-2xl
        border border-gray-100
        shadow-[0_1px_3px_rgba(0,0,0,0.04)]
        transition-all duration-200
        ${disabled ? 'opacity-60' : 'hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]'}
      `}
    >
      {/* Badge */}
      {badge && (
        <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-semibold text-text-muted bg-gray-100 rounded-full uppercase tracking-wide">
          {badge}
        </span>
      )}

      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: tintColor }}
      >
        <span className="material-symbols-rounded text-xl" style={{ color: iconColor }}>
          {icon}
        </span>
      </div>

      {/* Text */}
      <div>
        <h3 className="text-[15px] font-semibold text-text-primary leading-tight">
          {title}
        </h3>
        <p className="text-[13px] text-text-secondary mt-0.5 leading-snug">
          {description}
        </p>
      </div>
    </div>
  );

  if (disabled && onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left">
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

// Service definitions with color tints
const SERVICES = [
  {
    id: 'print',
    href: '/upload',
    icon: 'print',
    title: 'Print',
    description: 'Documents & assignments',
    tintColor: 'var(--tint-print)',
    iconColor: '#6366f1',
    enabled: true,
  },
  {
    id: 'marketplace',
    href: '/marketplace',
    icon: 'storefront',
    title: 'Marketplace',
    description: 'Buy & sell with peers',
    tintColor: 'var(--tint-marketplace)',
    iconColor: '#f43f5e',
    enabled: true,
  },
  {
    id: 'canteen',
    href: '/shopfront',
    icon: 'restaurant',
    title: 'Canteen',
    description: 'Food & beverages',
    tintColor: 'var(--tint-canteen)',
    iconColor: '#10b981',
    enabled: false,
    badge: 'Soon',
  },
  {
    id: 'support',
    href: '/contact',
    icon: 'support_agent',
    title: 'Support',
    description: 'Get help anytime',
    tintColor: 'var(--tint-support)',
    iconColor: '#f59e0b',
    enabled: true,
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function IndexPage() {
  const { user } = useUser();
  const firstName = user?.firstName || '';
  const greeting = getGreeting();

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
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Announcement Carousel */}
      <AnnouncementCarousel
        heightClass="h-44"
        outerClassName="px-4 pt-3"
        backgroundClass="bg-gray-100 rounded-2xl"
      />

      {/* Greeting */}
      <div className="px-4 pt-5 pb-1 animate-fade-up">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">
          {greeting}{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="text-[13px] text-text-secondary mt-0.5">
          What would you like to do today?
        </p>
      </div>

      {/* Services — 2×2 Grid */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          {SERVICES.map((service, i) => (
            <ServiceCard
              key={service.id}
              href={service.href}
              icon={service.icon}
              title={service.title}
              description={service.description}
              tintColor={service.tintColor}
              iconColor={service.iconColor}
              badge={service.badge}
              disabled={!service.enabled}
              staggerClass={`stagger-${i + 1}`}
              onClick={!service.enabled ? () => showToast('Coming soon') : undefined}
            />
          ))}
        </div>
      </div>

      {/* Recent Activity / Orders shortcut */}
      <div className="px-4 pt-5 animate-fade-up stagger-4">
        <Link
          href="/orders"
          className="
            flex items-center gap-3 px-4 py-3.5
            bg-white rounded-2xl
            border border-gray-100
            shadow-[0_1px_3px_rgba(0,0,0,0.04)]
            hover:shadow-md hover:-translate-y-0.5
            active:scale-[0.99]
            transition-all duration-200
          "
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-rounded text-lg text-primary">
              package_2
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-text-primary">My Orders</h3>
            <p className="text-[12px] text-text-secondary">Track your prints & purchases</p>
          </div>
          <span className="material-symbols-rounded text-text-muted text-xl">
            chevron_right
          </span>
        </Link>
      </div>

      {/* Footer */}
      <div className="mt-auto px-4 pb-5 pt-6">
        <p className="text-center text-[12px] text-text-muted">
          🎓 Built for students, by students
        </p>
      </div>
    </div>
  );
}
