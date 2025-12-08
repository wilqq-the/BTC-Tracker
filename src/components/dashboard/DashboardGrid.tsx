'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboardIcon,
  SaveIcon,
  PlusIcon,
  Settings2Icon,
  RotateCcwIcon,
  LineChartIcon,
  ArrowLeftRightIcon,
  TargetIcon,
  WalletIcon,
  TrendingUpIcon,
  ActivityIcon,
  CalendarIcon,
  RefreshCwIcon,
  ShieldIcon,
} from 'lucide-react';
import {
  GRID_COLS,
  GRID_ROW_HEIGHT,
  GRID_MARGIN,
  DEFAULT_LAYOUT,
  getWidgetDefinitionById,
} from '@/lib/dashboard-constants';
import { DashboardLayout, LayoutItem, WidgetType } from '@/lib/dashboard-types';

// Icon mapping for widget definitions
const WIDGET_ICONS: Record<string, React.ReactNode> = {
  'LineChart': <LineChartIcon className="size-4" />,
  'ArrowLeftRight': <ArrowLeftRightIcon className="size-4" />,
  'Target': <TargetIcon className="size-4" />,
  'Wallet': <WalletIcon className="size-4" />,
  'TrendingUp': <TrendingUpIcon className="size-4" />,
  'Activity': <ActivityIcon className="size-4" />,
  'Calendar': <CalendarIcon className="size-4" />,
  'RefreshCw': <RefreshCwIcon className="size-4" />,
  'Shield': <ShieldIcon className="size-4" />,
};

// Widget loading placeholder
const WidgetLoading = () => (
  <div className="h-full p-4 flex items-center justify-center animate-pulse bg-card border rounded-lg">
    <div className="text-sm text-muted-foreground">Loading...</div>
  </div>
);

// Dynamic imports with SSR disabled - each defined separately
const GridLayout = dynamic(() => import('react-grid-layout'), { ssr: false });
const ChartWidget = dynamic(() => import('@/components/widgets/BitcoinChartWidget'), { ssr: false, loading: WidgetLoading });
const PortfolioWidget = dynamic(() => import('@/components/widgets/PortfolioSummaryWidget'), { ssr: false, loading: WidgetLoading });
const TransactionsWidget = dynamic(() => import('@/components/widgets/LatestTransactionsWidget'), { ssr: false, loading: WidgetLoading });
const GoalsWidget = dynamic(() => import('@/components/widgets/GoalsOverviewWidget'), { ssr: false, loading: WidgetLoading });
const DCAWidget = dynamic(() => import('@/components/widgets/DCAAnalysisWidget'), { ssr: false, loading: WidgetLoading });
const TimeframeWidget = dynamic(() => import('@/components/widgets/MultiTimeframeWidget'), { ssr: false, loading: WidgetLoading });
const MonthlyWidget = dynamic(() => import('@/components/widgets/MonthlySummaryWidget'), { ssr: false, loading: WidgetLoading });
const AutoDCAWidget = dynamic(() => import('@/components/widgets/AutoDCAWidget'), { ssr: false, loading: WidgetLoading });
const WalletWidget = dynamic(() => import('@/components/widgets/WalletDistributionWidget'), { ssr: false, loading: WidgetLoading });

// Map widget types to components
const getWidgetComponent = (type: WidgetType): React.ComponentType<any> | null => {
  switch (type) {
    case 'chart': return ChartWidget;
    case 'portfolio': return PortfolioWidget;
    case 'transactions': return TransactionsWidget;
    case 'goals': return GoalsWidget;
    case 'dca': return DCAWidget;
    case 'timeframe': return TimeframeWidget;
    case 'monthly': return MonthlyWidget;
    case 'auto-dca': return AutoDCAWidget;
    case 'wallet-distribution': return WalletWidget;
    default: return null;
  }
};

/**
 * Dashboard Grid Component
 * Draggable & resizable widget grid using react-grid-layout
 */
export default function DashboardGrid() {
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef(layout);

  // Keep layoutRef in sync
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Track mount state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load layout from API
  useEffect(() => {
    loadLayout();
  }, []);

  // Update grid width
  useEffect(() => {
    if (!mounted || !containerRef.current) return;
    
    const updateWidth = () => {
      const width = containerRef.current?.offsetWidth || 0;
      if (width > 0) setGridWidth(width);
    };

    updateWidth();
    const timer = setTimeout(updateWidth, 100);
    window.addEventListener('resize', updateWidth);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [mounted, isLoading]);

  const loadLayout = async () => {
    try {
      const response = await fetch('/api/dashboard/layout');
      const result = await response.json();

      if (result.success && result.data?.widgets && Array.isArray(result.data.widgets)) {
        const savedLayout = result.data;
        
        // Validate and filter widgets - only keep valid ones
        const validWidgetTypes = ['chart', 'portfolio', 'transactions', 'goals', 'dca', 'timeframe', 'monthly', 'auto-dca', 'wallet-distribution'];
        const validWidgets = savedLayout.widgets.filter((w: any) => 
          w && w.id && w.type && validWidgetTypes.includes(w.type) &&
          typeof w.x === 'number' && typeof w.y === 'number' &&
          typeof w.w === 'number' && typeof w.h === 'number'
        );
        
        const savedWidgetIds = new Set(validWidgets.map((w: any) => w.id));
        
        // Add any missing widgets from default layout
        const newWidgets = DEFAULT_LAYOUT.widgets.filter(
          (defaultWidget) => !savedWidgetIds.has(defaultWidget.id)
        );
        
        const mergedLayout = {
          widgets: [
            ...validWidgets,
            ...newWidgets.map(w => ({ ...w, visible: false }))
          ]
        };
        
        setLayout(mergedLayout);
      } else {
        setLayout(DEFAULT_LAYOUT);
      }
    } catch (error) {
      console.error('Error loading layout:', error);
      setLayout(DEFAULT_LAYOUT);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLayout = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/dashboard/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      });
      const result = await response.json();
      if (result.success) {
        setHasChanges(false);
      } else {
        alert('Failed to save layout');
      }
    } catch (error) {
      console.error('Error saving layout:', error);
      alert('Failed to save layout');
    } finally {
      setIsSaving(false);
    }
  };

  const resetLayout = async () => {
    if (!confirm('Reset dashboard to default layout?')) return;
    try {
      await fetch('/api/dashboard/layout', { method: 'DELETE' });
      setLayout(DEFAULT_LAYOUT);
      setHasChanges(false);
      setIsEditMode(false);
    } catch (error) {
      console.error('Error resetting layout:', error);
    }
  };

  const handleLayoutChange = useCallback((newLayout: any[]) => {
    // Only process in edit mode
    if (!isEditMode) return;
    
    // Use functional update to get the CURRENT state, not stale layoutRef
    setLayout(currentLayout => {
    let hasActualChanges = false;
    const updatedWidgets = currentLayout.widgets.map(widget => {
      const gridItem = newLayout.find(item => item.i === widget.id);
      if (gridItem) {
          // Only update position if values actually changed
        if (widget.x !== gridItem.x || widget.y !== gridItem.y || 
            widget.w !== gridItem.w || widget.h !== gridItem.h) {
          hasActualChanges = true;
          return { ...widget, x: gridItem.x, y: gridItem.y, w: gridItem.w, h: gridItem.h };
        }
      }
      return widget;
    });

      // Only return new state if there were actual position changes
    if (hasActualChanges) {
      setHasChanges(true);
        return { widgets: updatedWidgets };
    }
      return currentLayout; // No changes, return same reference
    });
  }, [isEditMode]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setLayout(prev => ({
      widgets: prev.widgets.map(w => w.id === widgetId ? { ...w, visible: false } : w),
    }));
    setHasChanges(true);
  }, []);

  const handleAddWidget = useCallback((widgetId: string) => {
    setLayout(prev => ({
      // Set y to large value so react-grid-layout places it at the bottom via compaction
      widgets: prev.widgets.map(w => w.id === widgetId ? { ...w, visible: true, y: 9999 } : w),
    }));
    setHasChanges(true);
    setShowAddWidget(false);
  }, []);

  const toggleEditMode = () => {
    if (isEditMode && hasChanges) {
      if (confirm('Save changes before exiting edit mode?')) {
        saveLayout();
      }
    }
    setIsEditMode(!isEditMode);
  };

  // Filter widgets
  const visibleWidgets = layout.widgets.filter(w => w.visible !== false);
  const hiddenWidgets = layout.widgets.filter(w => w.visible === false);

  // Build grid layout
  const gridLayoutItems: LayoutItem[] = visibleWidgets.map(widget => {
    const def = getWidgetDefinitionById(widget.id);
    return {
      i: widget.id,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
      minW: def?.minW || 3,
      minH: def?.minH || 2,
      maxW: GRID_COLS,
      static: !isEditMode,
    };
  });


  // Show loading until mounted
  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="relative p-4 pb-8">
      {/* Dashboard Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-card border rounded-lg p-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LayoutDashboardIcon className="size-5 text-btc-500" />
            Dashboard
          </h2>
          {isEditMode && <Badge variant="default" className="text-xs">EDIT MODE</Badge>}
          {hasChanges && <Badge variant="secondary" className="text-xs">Unsaved</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isEditMode ? 'default' : 'outline'}
            size="sm"
            onClick={toggleEditMode}
          >
            <Settings2Icon className="size-4 mr-2" />
            {isEditMode ? 'Done' : 'Customize'}
          </Button>

          {isEditMode && (
            <>
              {hiddenWidgets.length > 0 && (
                <DropdownMenu open={showAddWidget} onOpenChange={setShowAddWidget}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <PlusIcon className="size-4 mr-2" />
                      Add Widget
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {hiddenWidgets.map(widget => {
                      const def = getWidgetDefinitionById(widget.id);
                      const icon = def?.icon ? WIDGET_ICONS[def.icon] : null;
                      return (
                        <DropdownMenuItem key={widget.id} onSelect={() => handleAddWidget(widget.id)}>
                          {icon && <span className="mr-2">{icon}</span>}
                          {def?.title}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button variant="outline" size="sm" onClick={resetLayout}>
                <RotateCcwIcon className="size-4 mr-2" />
                Reset
              </Button>

              <Button size="sm" onClick={saveLayout} disabled={!hasChanges || isSaving}>
                <SaveIcon className="size-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div ref={containerRef}>
          {gridWidth > 0 && GridLayout ? (
            <GridLayout
              className="layout"
              layout={gridLayoutItems}
              cols={GRID_COLS}
              rowHeight={GRID_ROW_HEIGHT}
              width={gridWidth}
              margin={GRID_MARGIN}
              containerPadding={[0, 0]}
              isDraggable={isEditMode}
              isResizable={isEditMode}
              resizeHandles={['se', 'e', 's']}
              onLayoutChange={isEditMode ? handleLayoutChange : undefined}
              compactType="vertical"
              draggableHandle=".drag-handle"
            >
              {visibleWidgets.map(widget => {
                const WidgetComponent = getWidgetComponent(widget.type);
                const def = getWidgetDefinitionById(widget.id);
                
                if (!WidgetComponent) {
                  console.warn('[Dashboard] No component for widget type:', widget.type);
                  return <div key={widget.id} />;
                }
                
                return (
                  <div key={widget.id} className="h-full w-full relative">
                    {/* Edit mode header overlay */}
                    {isEditMode && (
                      <div className="absolute top-0 left-0 right-0 z-20 bg-btc-500 text-white px-3 py-1.5 flex items-center justify-between drag-handle cursor-move rounded-t-lg">
                        <span className="text-xs font-medium">{def?.title}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 text-white hover:bg-white/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleRemoveWidget(widget.id);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                        >
                          ×
                        </Button>
                      </div>
                    )}
                    <div className={`h-full ${isEditMode ? 'pt-8' : ''}`}>
                      <WidgetComponent id={widget.id} />
                    </div>
                  </div>
                );
              })}
            </GridLayout>
          ) : (
            <div className="text-muted-foreground text-center py-8">Initializing grid...</div>
          )}
      </div>

      {/* Edit mode help */}
      {isEditMode && (
        <div className="mt-4 px-4">
          <div className="bg-btc-500/10 border border-btc-500/30 rounded-lg p-3">
            <p className="text-sm">
              <strong>Drag</strong> widgets by header to move. <strong>Resize</strong> by dragging edges. Click <strong>×</strong> to remove.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

