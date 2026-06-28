'use client';

import React, { useState } from 'react';
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

  return (
    <div className="relative h-screen overflow-hidden">
      {/* The ONE shared canvas — ambient orb wash showing through every gutter */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full bg-primary/20 blur-[150px]" />
        <div className="absolute top-1/4 -right-44 h-[34rem] w-[34rem] rounded-full bg-primary/12 blur-[160px]" />
        <div className="absolute -bottom-44 left-1/4 h-[34rem] w-[34rem] rounded-full bg-sky-500/12 blur-[160px]" />
      </div>

      {/* Foreground — floating panels on the canvas; p-3/gap-3 are the gutters */}
      <div className="relative z-10 flex h-full flex-col gap-3 p-3">
      {/* Floating header bar */}
      <Navigation onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Main row: floating sidebar + open-canvas content */}
      <div className="flex flex-1 gap-3 min-h-0">
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
        `}>
          <PortfolioSidebar onClose={() => setIsSidebarOpen(false)} />
        </div>

        {/* Main Content Area — open canvas; page cards/widgets float on it */}
        <main className="flex-1 min-w-0 overflow-y-auto rounded-2xl">
          {children}
        </main>
      </div>

      {/* Floating footer bar */}
      <footer className="glass-float rounded-2xl shrink-0 h-auto md:h-10 flex flex-col md:flex-row items-center justify-between px-4 md:px-6 py-2 md:py-0 gap-2 md:gap-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">BTC Tracker</span>
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          <span
            className="hidden sm:block"
            title={packageJson.version.includes('69') ? 'nice 😏' : undefined}
          >v{packageJson.version}</span>
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
            Support Project
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