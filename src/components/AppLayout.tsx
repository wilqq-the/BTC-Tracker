'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Navigation from './Navigation';
import PortfolioSidebar from './PortfolioSidebar';
import DonationModal from './DonationModal';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { HeartHandshakeIcon } from 'lucide-react';
import packageJson from '../../package.json';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Settings has its own menu column: hide the portfolio sidebar there on desktop.
  // It stays mounted (no refetch on return) and the mobile drawer keeps working.
  const pathname = usePathname();
  const hideSidebarOnDesktop = pathname?.startsWith('/settings') ?? false;

  return (
    <div className="relative h-screen overflow-hidden bg-background">
      {/* Solid cards on a warm canvas; p-4/gap-4 are the gutters */}
      <div className="relative flex h-full flex-col gap-4 p-2 sm:p-4">
      {/* Floating header bar */}
      <Navigation onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Main row: floating sidebar + open-canvas content */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Portfolio Sidebar - Desktop floating panel, Mobile slide-in drawer */}
        <div className={`
          fixed lg:relative lg:shrink-0
          inset-y-0 left-0
          transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          transition-transform duration-300 ease-in-out
          z-50 lg:z-0
          ${isSidebarOpen ? 'top-0 h-full p-3 lg:p-0' : ''}
          ${hideSidebarOnDesktop ? 'lg:hidden' : ''}
        `}>
          <PortfolioSidebar onClose={() => setIsSidebarOpen(false)} />
        </div>

        {/* Main Content Area — open canvas; page cards/widgets float on it */}
        <main className="flex-1 min-w-0 overflow-y-auto rounded-3xl">
          {children}
        </main>
      </div>

      {/* Floating footer bar */}
      <footer className="shrink-0 -mt-2 flex items-center justify-between gap-2 px-2 text-xs">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">BTC Tracker</span>
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          <span className="hidden sm:block">v{packageJson.version}</span>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
            <HeartHandshakeIcon className="size-3.5 text-primary" />
            <span>Made for the Bitcoin community</span>
          </span>
          <Button
            variant="link"
            size="sm"
            onClick={() => setIsDonationModalOpen(true)}
            className="h-auto p-0 text-xs text-primary hover:text-primary/80"
          >
            Support the project
          </Button>
        </div>
      </footer>

      {/* Donation Modal */}
      <DonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
      />
      </div>
    </div>
  );
} 