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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation Header */}
      <Navigation onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      {/* Main Layout */}
      <div className="flex flex-1 h-[calc(100vh-73px-40px)] relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Portfolio Sidebar - Desktop always visible, Mobile slide-in */}
        <div className={`
          fixed lg:relative
          inset-y-0 left-0
          transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          transition-transform duration-300 ease-in-out
          z-50 lg:z-0
          ${isSidebarOpen ? 'top-[73px] h-[calc(100vh-73px)]' : ''}
        `}>
          <PortfolioSidebar onClose={() => setIsSidebarOpen(false)} />
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-scroll">
          {children}
        </div>
      </div>

      {/* Footer */}
      <footer className="h-auto md:h-10 bg-background border-t flex flex-col md:flex-row items-center justify-between px-4 md:px-6 py-2 md:py-0 gap-2 md:gap-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">BTC Tracker</span>
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          <span className="hidden sm:block">v{packageJson.version}</span>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
            <HeartHandshakeIcon className="size-3.5 text-btc-500" />
            <span>Made for the Bitcoin community</span>
          </span>
          <Button
            variant="link"
            size="sm"
            onClick={() => setIsDonationModalOpen(true)}
            className="h-auto p-0 text-xs text-btc-500 hover:text-btc-600"
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
  );
} 