/**
 * TabNavigation Component
 * Pill tabs with a sliding indicator, styled like SegmentedControl.
 * Works uncontrolled (initialTabId) or controlled (activeTabId + onTabChange).
 */

'use client';

import React, { useLayoutEffect, useRef, useState, ReactNode } from 'react';
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
  /** Controlled active tab; pair with onTabChange */
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  'aria-label'?: string;
}

export default function TabNavigation({
  tabs,
  initialTabId,
  activeTabId,
  onTabChange,
  'aria-label': ariaLabel = 'Tabs',
}: TabNavigationProps) {
  const [internalTab, setInternalTab] = useState(initialTabId || tabs[0]?.id || '');
  const activeTab = activeTabId ?? internalTab;

  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const measure = () => {
      const el = itemRefs.current[activeTab];
      if (!el || !listRef.current) return;
      setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [activeTab, tabs.length]);

  const handleTabChange = (tabId: string) => {
    if (activeTabId === undefined) setInternalTab(tabId);
    onTabChange?.(tabId);
  };

  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  return (
    <div className="space-y-4">
      <div
        ref={listRef}
        className="relative flex w-fit max-w-full overflow-x-auto rounded-full bg-secondary p-1 scrollbar-hide"
        role="tablist"
        aria-label={ariaLabel}
      >
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-1 rounded-full bg-card shadow-sm',
            pill.ready && 'transition-[left,width] duration-[350ms] ease-[cubic-bezier(0.3,1.3,0.5,1)]'
          )}
          style={{ left: pill.left, width: pill.width, opacity: pill.ready ? 1 : 0 }}
        />
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              ref={(el) => { itemRefs.current[tab.id] = el; }}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'relative z-10 flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold transition-colors duration-200',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
            >
              {tab.icon && <span className="flex [&_svg]:size-4">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={cn(
                    'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                    isActive ? 'bg-tint-orange text-primary-strong' : 'bg-card text-muted-foreground'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTabData && (
        <div id={`tabpanel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
          {activeTabData.content}
        </div>
      )}
    </div>
  );
}
