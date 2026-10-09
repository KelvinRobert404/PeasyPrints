'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminGuard } from '@/lib/admin';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SwoopLogo } from '@/components/swoop/Logo';
import { IconTile, swButton } from '@/components/swoop/primitives';
import {
    GridIcon,
    LockIcon,
    OrdersIcon,
    RupeeIcon,
    SearchIcon,
    ShieldCheckIcon,
    StoreIcon,
    TicketIcon,
} from '@/components/swoop/icons';
import { cn } from '@/lib/utils/cn';
import { BellIcon, CapIcon, ChevronLeftIcon, FilmIcon, FlagIcon, MegaphoneIcon, MenuIcon, WalletIcon } from './icons';
import { Spinner } from './ui';

const NAV_ITEMS = [
    { href: '/godview', label: 'Dashboard', icon: GridIcon },
    { href: '/godview/announcements', label: 'Announcements', icon: MegaphoneIcon },
    { href: '/godview/orders', label: 'Orders', icon: OrdersIcon },
    { href: '/godview/stores', label: 'Stores', icon: StoreIcon },
    { href: '/godview/colleges', label: 'Colleges', icon: CapIcon },
    { href: '/godview/fees', label: 'Fees', icon: RupeeIcon },
    { href: '/godview/payouts', label: 'Payouts', icon: WalletIcon },
    { href: '/godview/coupons', label: 'Coupons', icon: TicketIcon },
    { href: '/godview/campus', label: 'Campus Trust', icon: ShieldCheckIcon },
    { href: '/godview/campus-content', label: 'Campus Content', icon: FlagIcon },
    { href: '/godview/reels', label: 'Reel Packs', icon: FilmIcon },
];

function Brand({ compact }: { compact?: boolean }) {
    if (compact) return <SwoopLogo size={9} />;
    return (
        <span className="flex items-center gap-2">
            <SwoopLogo size={15} />
            <span className="text-[12px] font-bold text-slate">godview</span>
        </span>
    );
}

function SidebarContent({ collapsed, email }: { collapsed?: boolean; email?: string | null }) {
    const pathname = usePathname();

    return (
        <div className="flex h-full flex-col border-r border-line bg-white text-ink">
            {/* Header */}
            <div className={cn('flex h-12 shrink-0 items-center border-b border-line px-4', collapsed && 'justify-center px-2')}>
                <Brand compact={collapsed} />
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto px-2 py-2.5">
                <nav aria-label="Godview" className="space-y-0.5">
                    {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                            item.href === '/godview'
                                ? pathname === '/godview' || pathname === '/godview/'
                                : pathname?.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                    'flex h-8 items-center gap-2.5 rounded-[9px] px-2.5 text-[12.5px] font-bold transition-colors',
                                    isActive ? 'bg-royal-tint text-royal' : 'text-text-secondary hover:bg-surface hover:text-ink',
                                    collapsed && 'justify-center px-0'
                                )}
                                title={collapsed ? item.label : undefined}
                            >
                                <Icon size={17} className="shrink-0" />
                                {!collapsed && <span className="truncate">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Footer */}
            {!collapsed && (
                <div className="border-t border-line p-2.5">
                    <div className="flex items-center gap-2.5 px-1.5 py-1">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface text-[10px] font-extrabold text-ink">
                            AD
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-bold text-ink">Administrator</p>
                            {email && <p className="truncate text-[10.5px] text-slate">{email}</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function GodviewLayout({ children }: { children: ReactNode }) {
    const { isAdmin, loading, email } = useAdminGuard();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-3">
                    <Spinner className="h-5 w-5" />
                    <p className="text-[12px] font-semibold text-slate">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white p-4">
                <div className="flex w-full max-w-[320px] flex-col items-center text-center">
                    <IconTile icon={LockIcon} shape="square" size={40} className="mb-3" />
                    <h1 className="font-heading text-[16px] text-ink">Access restricted</h1>
                    <p className="mt-1 text-[12px] text-slate">You don&apos;t have permission to view this area.</p>
                    <Link href="/" className={cn(swButton({ variant: 'primary', size: 'sm' }), 'mt-4')}>
                        Return to application
                    </Link>
                </div>
            </div>
        );
    }

    // Get current page title
    const currentRoute = NAV_ITEMS.find(item =>
        item.href === '/godview'
            ? pathname === '/godview'
            : pathname?.startsWith(item.href)
    );

    return (
        <div className="flex min-h-screen bg-white text-ink">
            {/* Mobile Header */}
            <div className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
                <Brand />
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                        <button type="button" aria-label="Open navigation" className="campus-press -mr-1.5 grid h-8 w-8 place-items-center rounded-full bg-surface text-ink">
                            <MenuIcon size={16} />
                        </button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-64 border-r-0 p-0">
                        <SidebarContent email={email} />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop Sidebar */}
            <aside
                className={cn(
                    'group fixed inset-y-0 left-0 z-30 hidden flex-col transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] lg:flex',
                    collapsed ? 'w-[60px]' : 'w-[220px]'
                )}
            >
                <div className="relative flex h-full flex-col">
                    <SidebarContent collapsed={collapsed} email={email} />

                    {/* Collapse Toggle */}
                    <button
                        type="button"
                        onClick={() => setCollapsed(!collapsed)}
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        className="absolute -right-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-full border border-line bg-white text-slate opacity-0 shadow-[0_1px_3px_rgba(16,24,40,0.10)] transition-[opacity,color] duration-150 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                    >
                        <ChevronLeftIcon size={11} className={cn('transition-transform', collapsed && 'rotate-180')} />
                    </button>

                    {/* Hover zone to show toggle */}
                    <div className="absolute bottom-0 right-0 top-0 w-4 translate-x-1/2 cursor-ew-resize bg-transparent" onClick={() => setCollapsed(!collapsed)} />
                </div>
            </aside>

            {/* Main Content */}
            <main
                className={cn(
                    'min-w-0 flex-1 pt-12 transition-[margin] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] lg:pt-0',
                    collapsed ? 'lg:ml-[60px]' : 'lg:ml-[220px]'
                )}
            >
                {/* Desktop Top Bar */}
                <div className="sticky top-0 z-20 hidden h-12 items-center justify-between border-b border-line bg-white px-6 lg:flex">
                    <div className="flex items-center gap-1.5 text-[12.5px]">
                        <span className="font-semibold text-slate">godview</span>
                        <span className="text-text-muted">/</span>
                        <span className="font-bold text-ink">{currentRoute?.label || 'Dashboard'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="relative flex h-8 w-64 items-center gap-2 rounded-full bg-surface pl-3 pr-1.5">
                            <SearchIcon size={14} className="shrink-0 text-ink" />
                            <input
                                type="text"
                                placeholder="Search..."
                                aria-label="Search"
                                className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate"
                            />
                            <span className="flex gap-0.5">
                                <kbd className="inline-flex h-[18px] items-center rounded-[5px] bg-white px-1 text-[10px] font-bold text-slate">⌘</kbd>
                                <kbd className="inline-flex h-[18px] items-center rounded-[5px] bg-white px-1 text-[10px] font-bold text-slate">K</kbd>
                            </span>
                        </label>
                        <button
                            type="button"
                            aria-label="Notifications"
                            className="campus-press grid h-8 w-8 place-items-center rounded-full bg-surface text-ink transition-colors hover:bg-line"
                        >
                            <BellIcon size={16} />
                        </button>
                    </div>
                </div>

                <div className="mx-auto max-w-[1600px] p-4 animate-in fade-in duration-300 lg:px-6 lg:py-5">
                    {children}
                </div>
            </main>
        </div>
    );
}
