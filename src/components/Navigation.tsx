'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ThemedButton, useTheme } from './ui/ThemeProvider';
import UserAvatar from './UserAvatar';

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
  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/user')
        .then(res => res.ok ? res.json() : null)
        .then(data => setUserData(data))
        .catch(console.error);
    }
  }, [session?.user?.email]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen && !(event.target as HTMLElement).closest('nav')) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  return (
    <nav className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section: Hamburger and Logo */}
          <div className="flex items-center space-x-3">
            {/* Hamburger Menu for Mobile */}
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {/* Logo and Brand */}
            <div 
              className="flex items-center space-x-2 md:space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => window.location.href = '/'}
            >
              <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-full h-full">
                  <path fill="#F7931A" d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.4s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.52 2.75 2.084v.006z"/>
                </svg>
              </div>
              <span className="text-gray-900 dark:text-gray-100 font-semibold text-base md:text-lg hidden sm:block">
                BTC Tracker
              </span>
            </div>
          </div>

          {/* Mobile Navigation Menu Button and Dropdown */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            {/* User Avatar */}
            {session?.user && (
              <UserAvatar 
                src={userData?.profilePicture}
                name={userData?.displayName || userData?.name}
                email={session.user.email || undefined}
                size="sm"
              />
            )}
          </div>

          {/* Desktop Navigation Menu */}
          <div className="hidden md:flex items-center space-x-1">
            <ThemedButton 
              variant={pathname === '/' ? "primary" : "ghost"}
              size="sm"
              onClick={() => window.location.href = '/'}
            >
              Dashboard
            </ThemedButton>
            
            <ThemedButton 
              variant={pathname === '/transactions' ? "primary" : "ghost"}
              size="sm"
              onClick={() => window.location.href = '/transactions'}
            >
              Transactions
            </ThemedButton>
            
            <ThemedButton 
              variant={pathname === '/analytics' ? "primary" : "ghost"}
              size="sm"
              onClick={() => window.location.href = '/analytics'}
            >
              Analytics
            </ThemedButton>
            
            <ThemedButton 
              variant={pathname === '/profile' ? "primary" : "ghost"}
              size="sm"
              onClick={() => window.location.href = '/profile'}
            >
              Profile
            </ThemedButton>
            
            <ThemedButton 
              variant={pathname === '/settings' ? "primary" : "ghost"}
              size="sm"
              onClick={() => window.location.href = '/settings'}
            >
              Settings
            </ThemedButton>
            
            <div className="ml-6 pl-6 border-l border-gray-300 dark:border-gray-600 flex items-center space-x-3">
              {session?.user && (
                <div className="flex items-center space-x-3">
                  <UserAvatar 
                    src={userData?.profilePicture}
                    name={userData?.displayName || userData?.name}
                    email={session.user.email || undefined}
                    size="sm"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                    {userData?.displayName || userData?.name || session.user.email?.split('@')[0]}
                </span>
                </div>
              )}
              <ThemedButton 
                variant="secondary" 
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              >
                Logout
              </ThemedButton>
            </div>

            {/* Theme Toggle */}
            <div className="ml-4">
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                title={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
              >
                <span className="text-gray-600 dark:text-gray-400">
                  {mounted ? (theme === 'dark' ? '🌙' : '☀️') : '🌙'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="px-4 py-2 space-y-1">
            <button
              onClick={() => {
                window.location.href = '/';
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/' 
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Dashboard
            </button>
            
            <button
              onClick={() => {
                window.location.href = '/transactions';
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/transactions' 
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Transactions
            </button>
            
              <button
                onClick={() => {
                  window.location.href = '/analytics';
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/analytics' 
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Analytics
              </button>
              
              <button
                onClick={() => {
                  window.location.href = '/profile';
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/profile' 
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Profile
              </button>
              
              <button
                onClick={() => {
                  window.location.href = '/settings';
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/settings' 
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Settings
              </button>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Logout
              </button>
            </div>
            
            {/* Theme Toggle in Mobile Menu */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-between"
              >
                <span>Theme</span>
                <span className="text-lg">{mounted ? (theme === 'dark' ? '🌙' : '☀️') : '⚡'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
} 