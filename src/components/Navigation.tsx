'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import {
  MenuIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
  LogOutIcon,
  LayoutDashboardIcon,
  ArrowLeftRightIcon,
  BarChart3Icon,
  TargetIcon,
  ChevronDownIcon,
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
import { cn } from '@/lib/utils';

interface NavigationProps {
  onMenuClick?: () => void;
}

export default function Navigation({ onMenuClick }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [userData, setUserData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  // Knob position for the theme toggle, updated one frame after the theme flips
  // so the slide animates (next-themes' disableTransitionOnChange suppresses
  // transitions on the switch frame itself).
  const [knobDark, setKnobDark] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setKnobDark(theme === 'dark'));
    return () => cancelAnimationFrame(id);
  }, [theme]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sliding "ferrofluid" nav indicator — follows hover, snaps to active page
  const navListRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const moveIndicatorTo = (el: HTMLElement | null) => {
    const parent = navListRef.current;
    if (!parent || !el) return;
    const p = parent.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const target = { left: r.left - p.left, width: r.width };

    // Phase 1 — stretch to span BOTH the current and target spots (the magnetic "reach")
    setIndicator((prev) => {
      if (!prev.opacity) return { ...target, opacity: 1 }; // first appearance: no stretch
      const left = Math.min(prev.left, target.left);
      const right = Math.max(prev.left + prev.width, target.left + target.width);
      return { left, width: right - left, opacity: 1 };
    });

    // Phase 2 — contract onto the target (the "snap back" of the liquid)
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      setIndicator({ ...target, opacity: 1 });
    }, 150);
  };

  const moveIndicatorToActive = () => {
    const el = itemRefs.current[pathname];
    if (el) moveIndicatorTo(el);
    else {
      clearTimeout(settleTimer.current);
      setIndicator((s) => ({ ...s, opacity: 0 }));
    }
  };

  // Set mounted state to prevent hydration mismatch
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

  // Snap the sliding indicator to the active page on load / route change / resize
  useEffect(() => {
    moveIndicatorToActive();
    const onResize = () => moveIndicatorToActive();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <nav className="glass-float rounded-2xl shrink-0">
      <div className="px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left Section: Hamburger and Logo */}
          <div className="flex items-center space-x-3">
            {/* Hamburger Menu for Sidebar (Mobile/Tablet) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="lg:hidden"
            >
              <MenuIcon className="h-5 w-5" />
            </Button>
            
            {/* Logo and Brand */}
            <button
              className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
              onClick={() => router.push('/')}
            >
              {/* Glass tile monogram — same frosted material as cards, gold ₿ */}
              <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-gradient-to-br from-primary/25 via-primary/10 to-transparent shadow-[inset_0_1px_0_hsl(0_0%_100%/0.18)] backdrop-blur transition-colors duration-200 group-hover:border-primary/50">
                <svg viewBox="-1 -1 26 26" className="size-5 drop-shadow-[0_1px_3px_hsl(33_92%_50%/0.45)]" aria-hidden>
                  <defs>
                    <linearGradient id="btc-gold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f9a847" />
                      <stop offset="100%" stopColor="#e07d0a" />
                    </linearGradient>
                  </defs>
                  <path fill="url(#btc-gold)" d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.4s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.52 2.75 2.084v.006z"/>
                </svg>
              </span>
              {/* Two-tone wordmark */}
              <span className="hidden items-baseline gap-1 text-lg leading-none sm:flex">
                <span className="font-bold tracking-tight text-foreground">BTC</span>
                <span className="font-medium text-muted-foreground">Tracker</span>
              </span>
            </button>
          </div>

          {/* Gooey filter — fuses the two indicator blobs into one stretching liquid shape */}
          <svg aria-hidden width="0" height="0" className="absolute">
            <defs>
              <filter id="nav-goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
              </filter>
            </defs>
          </svg>

          {/* Desktop Navigation — segmented control with a gooey "ferrofluid" indicator */}
          <div
            ref={navListRef}
            onMouseLeave={moveIndicatorToActive}
            className="relative hidden md:flex items-center gap-1 rounded-full border border-border/40 bg-card/30 backdrop-blur-md p-1 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]"
          >
            {/* Highlight stretches to span both spots then contracts — liquid/magnetic reach */}
            <div className="pointer-events-none absolute inset-0 opacity-25 dark:opacity-30 [filter:url(#nav-goo)]">
              <span
                className="absolute top-1 bottom-1 rounded-full bg-primary transition-[left,width,opacity] duration-[400ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]"
                style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
              />
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <button
                  key={item.href}
                  ref={(el) => { itemRefs.current[item.href] = el; }}
                  onClick={() => router.push(item.href)}
                  onMouseEnter={(e) => moveIndicatorTo(e.currentTarget)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    "relative z-10 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Section: Profile, Theme, Settings */}
          <div className="flex items-center space-x-2">
            {/* Theme Toggle — shadcn-style sun/moon crossfade */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : undefined}
              aria-label="Toggle theme"
            >
              <SunIcon className={cn(
                "size-5 transition-all duration-500",
                knobDark ? "-rotate-90 scale-0" : "rotate-0 scale-100"
              )} />
              <MoonIcon className={cn(
                "absolute size-5 transition-all duration-500",
                knobDark ? "rotate-0 scale-100" : "rotate-90 scale-0"
              )} />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {/* Profile Dropdown Menu */}
            {session?.user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="relative h-auto py-1.5 px-2 gap-2 hover:bg-muted/50"
                  >
                    <UserAvatar
                      src={userData?.profilePicture}
                      name={userData?.displayName || userData?.name}
                      email={session?.user?.email}
                      size="sm"
                    />
                    <div className="hidden sm:flex flex-col items-start w-[112px]">
                      {userData ? (
                        <span className="w-full truncate text-sm font-medium leading-tight">
                          {userData?.displayName || userData?.name || 'User'}
                        </span>
                      ) : (
                        <span className="h-4 w-20 rounded bg-muted animate-pulse" />
                      )}
                    </div>
                    <ChevronDownIcon className="h-4 w-4 text-muted-foreground hidden sm:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
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

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <MenuIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card">
          <div className="px-4 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Button
                  key={item.href}
                  variant={isActive ? "default" : "ghost"}
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    router.push(item.href);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
