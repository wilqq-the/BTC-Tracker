'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import {
  MenuIcon,
  XIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
  LogOutIcon,
  LayoutDashboardIcon,
  ArrowLeftRightIcon,
  BarChart3Icon,
  TargetIcon,
  ChevronDownIcon,
  PlusIcon,
  WalletIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import UserAvatar from '@/components/UserAvatar';
import AddTransactionModal from '@/components/AddTransactionModal';
import { emitTransactionsChanged } from '@/lib/app-events';
import { useFerroPill, FerroPillLayer } from '@/components/ui/ferro-pill';
import { useBtcUnit } from '@/hooks/use-btc-unit';
import { cn } from '@/lib/utils';
import { switchThemeWithReveal } from '@/lib/theme-transition';

interface NavigationProps {
  /** Opens the portfolio drawer on small screens */
  onMenuClick?: () => void;
}

export default function Navigation({ onMenuClick }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  // resolvedTheme is what's actually on screen; `theme` can lag behind it
  const { resolvedTheme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [userData, setUserData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const isDark = mounted && resolvedTheme === 'dark';
  const { unit, toggleUnit } = useBtcUnit();
  // Only animate the ₿/sats label after a click, not on every page load
  const [unitFlipped, setUnitFlipped] = useState(false);

  // Ferrofluid highlight: reaches toward the hovered item, settles on the active page
  const { containerRef: navListRef, blobRef, dropRef, moveTo, hide } = useFerroPill<HTMLDivElement>();
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const moveIndicatorTo = (el: HTMLElement | null) => moveTo(el);

  const moveIndicatorToActive = () => {
    const el = itemRefs.current[pathname];
    if (el) moveTo(el);
    else hide();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch extended user data
  const fetchUserData = () => {
    if (session?.user?.email) {
      fetch('/api/user')
        .then(res => res.ok ? res.json() : null)
        .then(data => setUserData(data))
        .catch(console.error);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [session?.user?.email]);

  // Refresh user data when window regains focus (catches avatar updates from settings)
  useEffect(() => {
    const handleFocus = () => fetchUserData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [session?.user?.email]);

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboardIcon },
    { href: '/transactions', label: 'Transactions', icon: ArrowLeftRightIcon },
    { href: '/analytics', label: 'Analytics', icon: BarChart3Icon },
    { href: '/goals', label: 'Planning', icon: TargetIcon },
  ];

  // Snap the sliding pill to the active page on load / route change / resize
  useEffect(() => {
    moveIndicatorToActive();
    setIsMobileMenuOpen(false);
    const onResize = () => moveIndicatorToActive();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <nav className="surface rounded-3xl shrink-0 relative z-30">
      <div className="flex items-center justify-between gap-3 py-2.5 pl-3 pr-2.5 sm:pl-5">
        {/* Logo */}
        <button
          className="group flex items-center gap-2.5"
          onClick={() => router.push('/')}
          aria-label="BTC Tracker home"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-extrabold transition-transform duration-300 ease-[cubic-bezier(0.3,1.4,0.5,1)] group-hover:-rotate-6 group-hover:scale-105">
            ₿
          </span>
          <span className="hidden text-[17px] font-bold tracking-tight sm:block">BTC Tracker</span>
        </button>

        {/* Desktop navigation — pills with a ferrofluid highlight */}
        <div
          ref={navListRef}
          onMouseLeave={moveIndicatorToActive}
          className="relative hidden md:flex items-center gap-1"
        >
          <FerroPillLayer blobRef={blobRef} dropRef={dropRef} />
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                ref={(el) => { itemRefs.current[item.href] = el; }}
                onClick={() => router.push(item.href)}
                onMouseEnter={(e) => moveIndicatorTo(e.currentTarget)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "relative z-10 rounded-full px-4 py-2.5 text-sm transition-colors duration-200",
                  isActive
                    ? "font-bold text-primary-strong"
                    : "font-semibold text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Right: add, theme, profile, mobile menu */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            onClick={() => setShowAddModal(true)}
            className="h-11 rounded-full px-3 font-bold sm:px-5 transition-transform duration-200 ease-[cubic-bezier(0.3,1.4,0.5,1)] hover:-translate-y-0.5 active:scale-95"
          >
            <PlusIcon className="size-4 sm:mr-1.5" strokeWidth={2.5} />
            <span className="hidden sm:inline">Add transaction</span>
          </Button>

          <Button
            variant="ghost"
            className={cn(
              'h-11 min-w-11 rounded-full bg-secondary px-3 font-extrabold hover:bg-accent',
              unit === 'sats' ? 'text-[13px]' : 'text-lg'
            )}
            onClick={() => { setUnitFlipped(true); toggleUnit(); }}
            title={unit === 'btc' ? 'Show amounts in sats' : 'Show amounts in BTC'}
            aria-label={unit === 'btc' ? 'Showing BTC. Switch to sats' : 'Showing sats. Switch to BTC'}
          >
            <span key={unit} className={cn('inline-block', unitFlipped && 'animate-pop')}>
              {unit === 'btc' ? '₿' : 'sats'}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative size-11 rounded-full bg-secondary hover:bg-accent"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const next = isDark ? 'light' : 'dark';
              switchThemeWithReveal(next, () => setTheme(next), { x: r.left + r.width / 2, y: r.top + r.height / 2 });
            }}
            title={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : undefined}
            aria-label="Toggle theme"
          >
            <SunIcon className={cn(
              "size-5 transition-all duration-500",
              isDark ? "-rotate-90 scale-0" : "rotate-0 scale-100"
            )} />
            <MoonIcon className={cn(
              "absolute size-5 transition-all duration-500",
              isDark ? "rotate-0 scale-100" : "rotate-90 scale-0"
            )} />
          </Button>

          {session?.user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-11 gap-2 rounded-full px-1.5 hover:bg-secondary sm:pr-3"
                  aria-label="Account menu"
                >
                  <UserAvatar
                    src={userData?.profilePicture}
                    name={userData?.displayName || userData?.name}
                    email={session?.user?.email}
                    size="sm"
                  />
                  <span className="hidden w-[96px] text-left lg:block">
                    {userData ? (
                      <span className="block truncate text-sm font-semibold">
                        {userData?.displayName || userData?.name || 'User'}
                      </span>
                    ) : (
                      <span className="block h-4 w-20 rounded bg-muted animate-pulse" />
                    )}
                  </span>
                  <ChevronDownIcon className="hidden size-4 text-muted-foreground lg:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-2xl" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none">
                      {userData?.displayName || userData?.name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut({ redirect: false })
                    window.location.href = '/auth/signin'
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOutIcon className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* One menu button on small screens: pages + portfolio drawer */}
          <Button
            variant="ghost"
            size="icon"
            className="size-11 rounded-full md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden px-2.5 pb-2.5 animate-fadeInUp">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-2xl px-4 py-3.5 text-sm font-semibold",
                    isActive ? "bg-tint-orange text-primary-strong" : "bg-secondary text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
            {onMenuClick && (
              <button
                onClick={() => { setIsMobileMenuOpen(false); onMenuClick(); }}
                className="col-span-2 flex items-center gap-2.5 rounded-2xl bg-secondary px-4 py-3.5 text-sm font-semibold"
              >
                <WalletIcon className="size-4" />
                Portfolio overview
              </button>
            )}
          </div>
        </div>
      )}

      <AddTransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={emitTransactionsChanged}
      />
    </nav>
  );
}
