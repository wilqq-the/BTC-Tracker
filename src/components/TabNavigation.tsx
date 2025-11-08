/**
 * TabNavigation Component
 * Modern, accessible tab navigation with state management
 * Industry-standard design pattern
 */

'use client';

import React, { useState, ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
  content: ReactNode;
}

interface TabNavigationProps {
  tabs: Tab[];
  initialTabId?: string;
  onTabChange?: (tabId: string) => void;
}

export default function TabNavigation({ tabs, initialTabId, onTabChange }: TabNavigationProps) {
  const [activeTab, setActiveTab] = useState(initialTabId || tabs[0]?.id || '');

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-btc-border-primary">
        <nav className="-mb-px flex space-x-2 overflow-x-auto scrollbar-hide" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  group relative min-w-0 flex-shrink-0 whitespace-nowrap py-3 px-4 text-sm font-medium transition-all duration-200
                  border-b-2 
                  ${isActive
                    ? 'border-bitcoin text-bitcoin'
                    : 'border-transparent text-btc-text-secondary hover:text-btc-text-primary hover:border-btc-border-secondary'
                  }
                `}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
              >
                <span className="flex items-center space-x-2">
                  {tab.icon && <span className="text-base">{tab.icon}</span>}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`
                      inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full
                      ${isActive
                        ? 'bg-bitcoin/20 text-bitcoin'
                        : 'bg-btc-bg-secondary text-btc-text-secondary'
                      }
                    `}>
                      {tab.badge}
                    </span>
                  )}
                </span>
                
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-bitcoin rounded-t-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTabData && (
        <div
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="animate-fadeIn"
        >
          {activeTabData.content}
        </div>
      )}
    </div>
  );
}

