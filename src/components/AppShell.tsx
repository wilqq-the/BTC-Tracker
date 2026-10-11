'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import AppLayout from './AppLayout';

/**
 * Persistent app shell. Lives in the root layout so it never remounts on
 * navigation — which keeps the PortfolioSidebar (and its data) alive across
 * page changes instead of refetching every time. Auth routes render bare,
 * without the portfolio chrome.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith('/auth');

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return <AppLayout>{children}</AppLayout>;
}
