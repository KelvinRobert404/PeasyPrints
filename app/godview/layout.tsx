'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminGuard } from '@/lib/admin';
import {
    Store,
    ShoppingCart,
    DollarSign,
    Tag,
    Users,
    FileCheck,
    LayoutDashboard,
    ChevronLeft,
    ChevronRight,
    Shield,
    Menu,
    Search,
    Bell,
    Settings,
    IndianRupee,
    GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

const NAV_ITEMS = [
    { href: '/godview', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/godview/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/godview/stores', label: 'Stores', icon: Store },
    { href: '/godview/colleges', label: 'Colleges', icon: GraduationCap },
    { href: '/godview/fees', label: 'Fees', icon: IndianRupee },
    { href: '/godview/coupons', label: 'Coupons', icon: Tag },
    { href: '/godview/users', label: 'Verifications', icon: Users },
    { href: '/godview/listings', label: 'Moderation', icon: FileCheck },
];

function SidebarContent({ collapsed, email }: { collapsed?: boolean; email?: string | null }) {
    const pathname = usePathname();

    return (
        <div className="flex h-full flex-col bg-zinc-950 text-zinc-400 border-r border-white/5">
            {/* Header */}
            <div className={`flex h-12 items-center px-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                {!collapsed && (
                    <div className="flex items-center gap-2.5 px-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                            <Shield className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-bold text-zinc-100 tracking-tight">Swoop <span className="font-normal text-zinc-400">GODVIEW</span></span>
                    </div>
                )}
                {collapsed && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white">
                        <Shield className="h-4 w-4" />
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto px-2 py-3">
                <nav className="space-y-0.5">
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
                                className={`group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all duration-200 ${isActive
                                    ? 'bg-white/10 text-zinc-50 shadow-sm'
                                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                                    } ${collapsed ? 'justify-center px-2' : ''}`}
                                title={collapsed ? item.label : undefined}
                            >
                                <Icon className={`h-4 w-4 flex-shrink-0 transition-colors ${isActive ? 'text-zinc-50' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                                {!collapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Footer */}
            {!collapsed && (
                <div className="border-t border-white/5 p-3">
                    <div className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-white/5 transition-colors cursor-pointer group">
                        <Avatar className="h-6 w-6 border border-white/10 rounded-full">
                            <AvatarImage src="" />
                            <AvatarFallback className="bg-zinc-800 text-zinc-300 text-[9px]">AD</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-xs font-medium text-zinc-300 group-hover:text-zinc-100">Administrator</p>
                        </div>
                        <Settings className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300" />
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
            <div className="flex min-h-screen items-center justify-center bg-zinc-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
                    <p className="text-xs text-zinc-500 font-medium tracking-tight">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
                <div className="w-full max-w-[320px] text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 border border-zinc-200 mb-4">
                        <Shield className="h-5 w-5 text-zinc-500" />
                    </div>
                    <h1 className="text-sm font-semibold text-zinc-900">Access Restricted</h1>
                    <p className="mt-1 text-xs text-zinc-500">You don't have permission to view this area.</p>
                    <Link href="/" className="mt-4 inline-flex h-8 items-center justify-center rounded-md bg-zinc-900 px-4 text-xs font-medium text-white hover:bg-zinc-800 transition-colors shadow-sm">
                        Return to Application
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
        <div className="flex min-h-screen bg-zinc-50/50">
            {/* Mobile Header */}
            <div className="fixed top-0 left-0 right-0 z-40 flex h-12 items-center justify-between bg-white/80 backdrop-blur-md border-b border-zinc-200/50 px-4 lg:hidden">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white">
                        <Shield className="h-3 w-3" />
                    </div>
                    <span className="text-sm font-bold text-zinc-900 tracking-tight">Swoop <span className="font-normal text-zinc-500">GODVIEW</span></span>
                </div>
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8 text-zinc-500">
                            <Menu className="h-4 w-4" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 border-r-zinc-800 w-64 bg-zinc-950">
                        <SidebarContent email={email} />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop Sidebar */}
            <aside
                className={`hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${collapsed ? 'w-[60px]' : 'w-[240px]'
                    }`}
            >
                <div className="relative flex h-full flex-col bg-zinc-950">
                    <SidebarContent collapsed={collapsed} email={email} />

                    {/* Minimal Collapse Toggle */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="group absolute -right-3 top-4 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 shadow-sm hover:text-zinc-600 hover:border-zinc-300 transition-all opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 lg:group-hover:opacity-100"
                    >
                        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                    </button>

                    {/* Hover zone to show toggle */}
                    <div className="absolute right-0 top-0 bottom-0 w-4 translate-x-1/2 bg-transparent group cursor-ew-resize" onClick={() => setCollapsed(!collapsed)} />
                </div>
            </aside>

            {/* Main Content */}
            <main
                className={`flex-1 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${collapsed ? 'lg:ml-[60px]' : 'lg:ml-[240px]'
                    } pt-12 lg:pt-0`}
            >
                {/* Desktop Top Bar */}
                <div className="sticky top-0 z-20 hidden lg:flex h-12 items-center justify-between border-b border-zinc-200 bg-white/70 backdrop-blur-xl px-6">
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <span className="font-bold text-zinc-900">Swoop <span className="font-normal text-zinc-500">GODVIEW</span></span>
                        <span className="text-zinc-300">/</span>
                        <span className="text-zinc-600">{currentRoute?.label || 'Dashboard'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="h-8 w-64 rounded-md border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-100/50 transition-all"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                <kbd className="inline-flex h-4 items-center rounded border border-zinc-200 bg-white px-1 text-[10px] font-medium text-zinc-400">⌘</kbd>
                                <kbd className="inline-flex h-4 items-center rounded border border-zinc-200 bg-white px-1 text-[10px] font-medium text-zinc-400">K</kbd>
                            </div>
                        </div>
                        <div className="h-4 w-px bg-zinc-200" />
                        <button className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
                            <Bell className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="p-4 lg:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-300 slide-in-from-bottom-2">
                    {children}
                </div>
            </main>
        </div>
    );
}
