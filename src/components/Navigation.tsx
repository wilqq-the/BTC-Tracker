'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import {
  MenuIcon,
  SunIcon,
  MoonIcon,
  UserIcon,
  SettingsIcon,
  LogOutIcon,
  LayoutDashboardIcon,
  ArrowLeftRightIcon,
  BarChart3Icon,
  TargetIcon,
  ChevronDownIcon,
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

interface NavigationProps {
  onMenuClick?: () => void;
}

export default function Navigation({ onMenuClick }: NavigationProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [userData, setUserData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    { href: '/wallets', label: 'Wallets', icon: WalletIcon },
    { href: '/analytics', label: 'Analytics', icon: BarChart3Icon },
    { href: '/goals', label: 'Planning', icon: TargetIcon },
  ];

  return (
    <nav className="bg-card border-b border-border">
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
              className="flex items-center space-x-2 md:space-x-3 hover:opacity-80 transition-opacity"
              onClick={() => window.location.href = '/'}
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0 overflow-visible">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 26 26" className="w-full h-full">
                  <path fill="#F7931A" d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.4s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.52 2.75 2.084v.006z"/>
                </svg>
              </div>
              <span className="text-foreground font-semibold text-lg hidden sm:block">
                BTC Tracker
              </span>
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Button
                  key={item.href}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => window.location.href = item.href}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>

          {/* Right Section: Profile, Theme, Settings */}
          <div className="flex items-center space-x-2">
            {/* Theme Toggle */}
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <SunIcon className="h-5 w-5" />
                ) : (
                  <MoonIcon className="h-5 w-5" />
                )}
              </Button>
            )}

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
                    <div className="hidden sm:flex flex-col items-start">
                      <span className="text-sm font-medium leading-tight max-w-[120px] truncate">
                        {userData?.displayName || userData?.name || 'User'}
                      </span>
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
                    <DropdownMenuItem onClick={() => window.location.href = '/profile'}>
                      <UserIcon className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.location.href = '/settings'}>
                      <SettingsIcon className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => signOut({ callbackUrl: '/auth/signin' })}
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
                    window.location.href = item.href;
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
