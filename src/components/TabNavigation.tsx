/**
 * TabNavigation Component
 * Modern, accessible tab navigation with state management
 * Industry-standard design pattern
 */

'use client';

import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

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

  // Gooey "ferrofluid" sliding indicator — same flow selector as the header menu
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const moveIndicatorTo = (el: HTMLElement | null) => {
    const parent = listRef.current;
    if (!parent || !el) return;
    const p = parent.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const target = { left: r.left - p.left + parent.scrollLeft, width: r.width };
    // Phase 1 — stretch to span both spots (the liquid "reach")
    setIndicator((prev) => {
      if (!prev.opacity) return { ...target, opacity: 1 };
      const left = Math.min(prev.left, target.left);
      const right = Math.max(prev.left + prev.width, target.left + target.width);
      return { left, width: right - left, opacity: 1 };
    });
    // Phase 2 — contract onto the target
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setIndicator({ ...target, opacity: 1 }), 150);
  };

  const moveIndicatorToActive = () => {
    const el = itemRefs.current[activeTab];
    if (el) moveIndicatorTo(el);
    else {
      clearTimeout(settleTimer.current);
      setIndicator((s) => ({ ...s, opacity: 0 }));
    }
  };

  useEffect(() => {
    moveIndicatorToActive();
    const onResize = () => moveIndicatorToActive();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tabs.length]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <>
      {/* Gooey filter for the tab indicator */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <filter id="tab-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
          </filter>
        </defs>
      </svg>
      <div className="space-y-6">
      {/* Tab Navigation — glass segmented control with the gooey sliding indicator */}
      <div
        ref={listRef}
        onMouseLeave={moveIndicatorToActive}
        className="relative flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-border/40 bg-card/30 p-1 backdrop-blur-md scrollbar-hide shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]"
        role="tablist"
        aria-label="Tabs"
      >
        {/* Liquid highlight that stretches between tabs */}
        <div className="pointer-events-none absolute inset-0 opacity-25 dark:opacity-30 [filter:url(#tab-goo)]">
          <span
            className="absolute top-1 bottom-1 rounded-full bg-primary transition-[left,width,opacity] duration-[400ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]"
            style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
          />
        </div>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              ref={(el) => { itemRefs.current[tab.id] = el; }}
              onClick={() => handleTabChange(tab.id)}
              onMouseEnter={(e) => moveIndicatorTo(e.currentTarget)}
              className={cn(
                "relative z-10 flex-shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
            >
              <span className="flex items-center gap-2">
                {tab.icon && <span className="text-base">{tab.icon}</span>}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={cn(
                    "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums",
                    isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
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
    </>
  );
}

