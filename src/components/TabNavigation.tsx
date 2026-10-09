/**
 * TabNavigation Component
 * Pill tabs with a ferrofluid indicator (the header nav's FerroPill): it
 * reaches toward the hovered tab and stretches and snaps when switching.
 * Works uncontrolled (initialTabId) or controlled (activeTabId + onTabChange).
 */

'use client';

import React, { useLayoutEffect, useRef, useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FerroPillLayer, useFerroPill } from '@/components/ui/ferro-pill';

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

  const { containerRef: listRef, blobRef, dropRef, moveTo } = useFerroPill<HTMLDivElement>();
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const settle = () => moveTo(itemRefs.current[activeTab]);

  useLayoutEffect(() => {
    const measure = () => moveTo(itemRefs.current[activeTab]);
    measure();
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [activeTab, tabs.length, moveTo, listRef]);

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
        onMouseLeave={settle}
      >
        <FerroPillLayer blobRef={blobRef} dropRef={dropRef} className="bg-card" blobClassName="inset-y-1" />
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              ref={(el) => { itemRefs.current[tab.id] = el; }}
              onClick={() => handleTabChange(tab.id)}
              onMouseEnter={(e) => moveTo(e.currentTarget)}
              onFocus={(e) => moveTo(e.currentTarget)}
              onBlur={settle}
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
