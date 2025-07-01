'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ThemedButton, useTheme } from './ui/ThemeProvider';
import UserAvatar from './UserAvatar';

export default function Navigation() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [userData, setUserData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

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

  return (
    <nav className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => window.location.href = '/'}
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-8 h-8">
                <path fill="#F7931A" d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.4s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.52 2.75 2.084v.006z"/>
              </svg>
            </div>
            <span className="text-gray-900 dark:text-gray-100 font-semibold text-lg">
              BTC Tracker
            </span>
          </div>

          {/* Navigation Menu */}
          <div className="flex items-center space-x-1">
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
            
            <ThemedButton variant="ghost" size="sm">
              Exchanges
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
    </nav>
  );
} 