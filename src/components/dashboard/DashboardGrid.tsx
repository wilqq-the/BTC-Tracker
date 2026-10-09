'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
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
  GripVerticalIcon,
  XIcon,
  ZapIcon,
  BitcoinIcon,
  TrophyIcon,
  CheckIcon,
} from 'lucide-react';
import {
  GRID_COLS,
  GRID_ROW_HEIGHT,
  GRID_MARGIN,
  DEFAULT_LAYOUT,
  AVAILABLE_WIDGETS,
  getWidgetDefinitionById,
} from '@/lib/dashboard-constants';
import { DashboardLayout, LayoutItem, WidgetType } from '@/lib/dashboard-types';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/components/ui/confirm-dialog';

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
  'Zap': <ZapIcon className="size-4" />,
  'Bitcoin': <BitcoinIcon className="size-4" />,
  'Trophy': <TrophyIcon className="size-4" />,
};

// Below this width widgets stack in one column (no drag/resize on phones)
const STACK_BREAKPOINT = 768;

// Pixel height of a widget spanning `h` grid rows
const rowsToPx = (h: number) => h * GRID_ROW_HEIGHT + (h - 1) * GRID_MARGIN[1];

// Widget loading placeholder
const WidgetLoading = () => (
  <div className="h-full rounded-2xl surface animate-pulse" />
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
const HeroWidget = dynamic(() => import('@/components/widgets/PortfolioHeroWidget'), { ssr: false, loading: WidgetLoading });
const QuickActionsWidget = dynamic(() => import('@/components/widgets/QuickActionsWidget'), { ssr: false, loading: WidgetLoading });
const BtcPriceWidget = dynamic(() => import('@/components/widgets/BtcPriceWidget'), { ssr: false, loading: WidgetLoading });
const MilestonesWidget = dynamic(() => import('@/components/widgets/MilestonesWidget'), { ssr: false, loading: WidgetLoading });

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
    case 'hero': return HeroWidget;
    case 'quick-actions': return QuickActionsWidget;
    case 'btc-price': return BtcPriceWidget;
    case 'milestones': return MilestonesWidget;
    default: return null;
  }
};

/**
 * Dashboard Grid Component
 * Draggable & resizable widget grid using react-grid-layout
 */
export default function DashboardGrid() {
  const { data: session } = useSession();
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
        const validWidgetTypes: string[] = AVAILABLE_WIDGETS.map(w => w.type);
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
        toast({ title: 'Dashboard saved', variant: 'success' });
      } else {
        toast({ title: 'Failed to save layout', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error saving layout:', error);
      toast({ title: 'Failed to save layout', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetLayout = async () => {
    if (!(await confirm({
      title: 'Reset dashboard?',
      description: 'This restores the default widget layout. Your customizations will be lost.',
      confirmText: 'Reset',
      destructive: true,
    }))) return;
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

  const toggleEditMode = async () => {
    if (isEditMode && hasChanges) {
      if (await confirm({
        title: 'Save changes?',
        description: 'You have unsaved layout changes. Save them before exiting edit mode?',
        confirmText: 'Save',
        cancelText: 'Discard',
      })) {
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

  const isStacked = gridWidth > 0 && gridWidth < STACK_BREAKPOINT;
  const firstName = (session?.user?.name || '').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const renderWidget = (widget: typeof visibleWidgets[number]) => {
    const WidgetComponent = getWidgetComponent(widget.type);
    if (!WidgetComponent) {
      console.warn('[Dashboard] No component for widget type:', widget.type);
      return null;
    }
    return <WidgetComponent id={widget.id} />;
  };

  return (
    <div className="relative pb-6">
      {/* Dashboard bar: greeting + customize; turns into the edit toolbar */}
      {isEditMode ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-tint-orange px-4 py-3 animate-fadeInUp">
          <div className="flex items-center gap-2 text-sm">
            <Settings2Icon className="size-4 text-primary-strong" />
            <span className="font-bold text-primary-strong">Editing dashboard</span>
            <span className="hidden text-muted-foreground sm:inline">· drag by the header, resize from the corner, × to hide</span>
            {hasChanges && <Badge variant="secondary" className="rounded-full">Unsaved</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hiddenWidgets.length > 0 && (
              <DropdownMenu open={showAddWidget} onOpenChange={setShowAddWidget}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full bg-card">
                    <PlusIcon className="size-4 mr-1.5" />
                    Add widget
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 rounded-2xl">
                  {hiddenWidgets.map(widget => {
                    const def = getWidgetDefinitionById(widget.id);
                    const icon = def?.icon ? WIDGET_ICONS[def.icon] : null;
                    return (
                      <DropdownMenuItem key={widget.id} onSelect={() => handleAddWidget(widget.id)} className="items-start gap-2.5 rounded-xl py-2">
                        {icon && <span className="mt-0.5 text-primary-strong">{icon}</span>}
                        <span className="flex flex-col">
                          <span className="font-semibold">{def?.title}</span>
                          {def?.description && <span className="text-xs text-muted-foreground">{def.description}</span>}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" size="sm" className="rounded-full bg-card" onClick={resetLayout}>
              <RotateCcwIcon className="size-4 mr-1.5" />
              Reset
            </Button>
            <Button variant="outline" size="sm" className="rounded-full bg-card" onClick={saveLayout} disabled={!hasChanges || isSaving}>
              <SaveIcon className="size-4 mr-1.5" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" className="rounded-full" onClick={toggleEditMode}>
              <CheckIcon className="size-4 mr-1.5" />
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <h1 className="text-lg font-bold tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h1>
          {!isStacked && (
            <Button variant="ghost" size="sm" className="rounded-full font-semibold text-muted-foreground hover:bg-card hover:text-foreground" onClick={toggleEditMode}>
              <Settings2Icon className="size-4 mr-1.5" />
              Customize
            </Button>
          )}
        </div>
      )}

      {/* Grid */}
      {/* The grid fades in once; the hero's count-up and chart draw are the only orchestrated motion */}
      <div ref={containerRef} className={`animate-fadeIn ${isEditMode ? 'dashboard-editing' : 'dashboard-view'}`}>
          {isStacked ? (
            // Phones: one column in reading order, natural heights
            <div className="flex flex-col gap-4">
              {[...visibleWidgets]
                .sort((a, b) => a.y - b.y || a.x - b.x)
                .map(widget => (
                  <div
                    key={widget.id}
                    style={{
                      // compact widgets (h ≤ 2) size to their content
                      height: widget.type === 'hero' ? 560 : widget.h <= 2 ? undefined : Math.max(rowsToPx(widget.h), 300),
                    }}
                  >
                    {renderWidget(widget)}
                  </div>
                ))}
            </div>
          ) : gridWidth > 0 && GridLayout ? (
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
                const def = getWidgetDefinitionById(widget.id);
                return (
                  <div key={widget.id} className="h-full w-full">
                    {/* widget-shell carries the drag pick-up transform */}
                    <div className="widget-shell">
                      <div className="relative h-full">
                        {isEditMode && (
                          <div className="drag-handle absolute inset-x-0 top-0 z-20 flex cursor-grab items-center justify-between gap-2 rounded-t-2xl bg-tint-orange px-4 py-2 active:cursor-grabbing">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-primary-strong">
                              <GripVerticalIcon className="size-4 opacity-70" />
                              {def?.title}
                            </span>
                            <button
                              aria-label={`Hide ${def?.title ?? 'widget'}`}
                              className="flex size-6 items-center justify-center rounded-full text-primary-strong hover:bg-card"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleRemoveWidget(widget.id);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                            >
                              <XIcon className="size-3.5" />
                            </button>
                          </div>
                        )}
                        <div className={`h-full ${isEditMode ? 'pt-9 pointer-events-none select-none' : ''}`}>
                          {renderWidget(widget)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </GridLayout>
          ) : (
            <div className="h-96" />
          )}
      </div>
    </div>
  );
}
