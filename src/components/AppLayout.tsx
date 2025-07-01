'use client';

import React, { useState } from 'react';
import Navigation from './Navigation';
import PortfolioSidebar from './PortfolioSidebar';
import DonationModal from './DonationModal';
import { ThemedText } from './ui/ThemeProvider';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-btc-bg-primary flex flex-col">
      {/* Navigation Header */}
      <Navigation />
      
      {/* Main Layout */}
      <div className="flex flex-1 h-[calc(100vh-73px-40px)]">
        {/* Portfolio Sidebar - Always Visible */}
        <PortfolioSidebar />
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>

      {/* Subtle Footer */}
      <footer className="h-10 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
        <ThemedText variant="muted" size="xs">
          Bitcoin Tracker v1.0 • Open Source
        </ThemedText>
        
        <div className="flex items-center space-x-4">
          <ThemedText variant="muted" size="xs">
            Made with ❤️ for the Bitcoin community
          </ThemedText>
          <button
            onClick={() => setIsDonationModalOpen(true)}
            className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium transition-colors hover:underline"
          >
            Support Development
          </button>
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