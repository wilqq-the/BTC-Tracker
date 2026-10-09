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

const DISCORD_URL = 'https://discord.gg/cmACNxcDqq';

/** Discord's logo (Lucide has no brand icons) */
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029ZM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

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
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join the BTC Tracker Discord"
            className="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-[#5865F2]"
          >
            <DiscordIcon className="size-3.5 group-hover:animate-hop" />
            <span className="hidden sm:inline">Discord</span>
          </a>
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