'use client';

import React, { useState, useEffect, useCallback } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import WidgetContainer from './WidgetContainer';
import { 
  DashboardLayout, 
  WidgetInstance, 
  LayoutItem 
} from '@/lib/dashboard-types';
import {
  GRID_COLS,
  GRID_ROW_HEIGHT,
  GRID_MARGIN,
  DEFAULT_LAYOUT,
  AVAILABLE_WIDGETS,
  getWidgetDefinitionById,
} from '@/lib/dashboard-constants';
import { ThemedButton } from '@/components/ui/ThemeProvider';

/**
 * Dashboard Grid Component
 * Main grid container with drag & drop functionality
 */
export default function DashboardGrid() {
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const gridContainerRef = React.useRef<HTMLDivElement>(null);

  // Load user's saved layout on mount
  useEffect(() => {
    loadLayout();
  }, []);

  // Update grid width using ResizeObserver for better detection
  useEffect(() => {
    const updateGridWidth = () => {
      if (gridContainerRef.current) {
        const containerWidth = gridContainerRef.current.offsetWidth;
        console.log('[Grid] Container width:', containerWidth);
        if (containerWidth > 0) {
          setGridWidth(containerWidth);
        }
      }
    };

    // Multiple attempts to calculate width
    updateGridWidth(); // Immediate
    
    const timer1 = setTimeout(updateGridWidth, 0); // Next tick
    const timer2 = setTimeout(updateGridWidth, 100); // After 100ms
    const timer3 = setTimeout(updateGridWidth, 300); // After 300ms

    // Use ResizeObserver for more reliable container size detection
    let resizeObserver: ResizeObserver | null = null;
    
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          console.log('[Grid] ResizeObserver detected width:', width);
          if (width > 0) {
            setGridWidth(width);
          }
        }
      });

      if (gridContainerRef.current) {
        resizeObserver.observe(gridContainerRef.current);
      }
    }

    // Fallback: also listen to window resize
    window.addEventListener('resize', updateGridWidth);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateGridWidth);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Recalculate width when loading state changes (after layout is loaded)
  useEffect(() => {
    if (!isLoading && gridContainerRef.current) {
      const containerWidth = gridContainerRef.current.offsetWidth;
      if (containerWidth > 0) {
        setGridWidth(containerWidth);
      }
    }
  }, [isLoading]);

  const loadLayout = async () => {
    try {
      const response = await fetch('/api/dashboard/layout');
      const result = await response.json();

      if (result.success && result.data) {
        // Merge saved layout with default layout to include new widgets
        const savedLayout = result.data;
        const savedWidgetIds = new Set(savedLayout.widgets.map((w: any) => w.id));
        
        // Find widgets in default layout that aren't in saved layout
        const newWidgets = DEFAULT_LAYOUT.widgets.filter(
          (defaultWidget) => !savedWidgetIds.has(defaultWidget.id)
        );
        
        // Merge: keep all saved widgets + add new widgets (hidden by default)
        const mergedLayout = {
          widgets: [
            ...savedLayout.widgets,
            ...newWidgets.map(w => ({ ...w, visible: false }))
          ]
        };
        
        setLayout(mergedLayout);
      } else {
        // Use default layout if no saved layout
        setLayout(DEFAULT_LAYOUT);
      }
    } catch (error) {
      console.error('Error loading dashboard layout:', error);
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ layout }),
      });

      const result = await response.json();

      if (result.success) {
        setHasChanges(false);
        console.log('Layout saved successfully');
        // Optional: Show a brief success message
        // You could add a toast notification here if you want
      } else {
        console.error('Failed to save layout:', result.error);
        alert('Failed to save layout: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving layout:', error);
      alert('Failed to save layout');
    } finally {
      setIsSaving(false);
    }
  };

  const resetLayout = async () => {
    if (!confirm('Reset dashboard to default layout? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/dashboard/layout', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setLayout(DEFAULT_LAYOUT);
        setHasChanges(false);
        setIsEditMode(false);
        console.log('Layout reset to default');
      } else {
        console.error('Failed to reset layout:', result.error);
        alert('Failed to reset layout: ' + result.error);
      }
    } catch (error) {
      console.error('Error resetting layout:', error);
      alert('Failed to reset layout');
    }
  };

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    // Only update if in edit mode (prevents triggering on initial mount)
    if (!isEditMode) return;

    // Update widget positions based on grid changes
    const updatedWidgets = layout.widgets.map(widget => {
      const gridItem = newLayout.find(item => item.i === widget.id);
      if (gridItem) {
        return {
          ...widget,
          x: gridItem.x,
          y: gridItem.y,
          w: gridItem.w,
          h: gridItem.h,
        };
      }
      return widget;
    });

    setLayout({ widgets: updatedWidgets });
    setHasChanges(true);
  }, [layout, isEditMode]);

  const handleRemoveWidget = (widgetId: string) => {
    setLayout({
      widgets: layout.widgets.map(w =>
        w.id === widgetId ? { ...w, visible: false } : w
      ),
    });
    setHasChanges(true);
  };

  const handleAddWidget = (widgetId: string) => {
    const widget = layout.widgets.find(w => w.id === widgetId);
    if (widget) {
      setLayout({
        widgets: layout.widgets.map(w =>
          w.id === widgetId ? { ...w, visible: true } : w
        ),
      });
      setHasChanges(true);
      setShowAddWidget(false);
    }
  };

  const toggleEditMode = () => {
    if (isEditMode && hasChanges) {
      if (confirm('You have unsaved changes. Save before exiting edit mode?')) {
        saveLayout();
      }
    }
    setIsEditMode(!isEditMode);
  };

  // Convert widget instances to grid layout items
  const gridLayout: LayoutItem[] = layout.widgets
    .filter(w => w.visible !== false)
    .map(widget => {
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

  const visibleWidgets = layout.widgets.filter(w => w.visible !== false);
  const hiddenWidgets = layout.widgets.filter(w => w.visible === false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600 dark:text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  // Use calculated width or fallback to window width minus padding
  const effectiveWidth = gridWidth > 0 ? gridWidth : (typeof window !== 'undefined' ? window.innerWidth - 32 : 1200);

  return (
    <div className="relative pt-4">
      {/* Dashboard Controls */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard
          </h1>
          {isEditMode && (
            <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-semibold rounded-full">
              EDIT MODE
            </span>
          )}
          {hasChanges && (
            <span className="text-xs text-orange-600 dark:text-orange-400">
              • Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {isEditMode && (
            <>
              {hiddenWidgets.length > 0 && (
                <div className="relative">
                  <ThemedButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAddWidget(!showAddWidget)}
                  >
                    + Add Widget
                  </ThemedButton>
                  {showAddWidget && (
                    <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 w-64">
                      <div className="p-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2">
                          Add hidden widgets:
                        </p>
                        {hiddenWidgets.map(widget => {
                          const def = getWidgetDefinitionById(widget.id);
                          return (
                            <button
                              key={widget.id}
                              onClick={() => handleAddWidget(widget.id)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm flex items-center space-x-2"
                            >
                              <span>{def?.icon}</span>
                              <span>{def?.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <ThemedButton
                variant="secondary"
                size="sm"
                onClick={resetLayout}
              >
                Reset
              </ThemedButton>
              <ThemedButton
                variant="primary"
                size="sm"
                onClick={saveLayout}
                disabled={!hasChanges || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Layout'}
              </ThemedButton>
            </>
          )}
          <ThemedButton
            variant={isEditMode ? 'secondary' : 'primary'}
            size="sm"
            onClick={toggleEditMode}
          >
            {isEditMode ? 'Exit Edit Mode' : 'Edit Layout'}
          </ThemedButton>
        </div>
      </div>

      {/* Grid Container */}
      <div className="px-4">
        <div ref={gridContainerRef}>
          <GridLayout
            className="layout"
            layout={gridLayout}
            cols={GRID_COLS}
            rowHeight={GRID_ROW_HEIGHT}
            width={effectiveWidth}
            margin={GRID_MARGIN}
            containerPadding={[0, 0]}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            onLayoutChange={handleLayoutChange}
            compactType="vertical"
            preventCollision={false}
            draggableHandle=".drag-handle"
          >
            {visibleWidgets.map(widget => (
              <div key={widget.id}>
                <WidgetContainer
                  id={widget.id}
                  type={widget.type}
                  isEditMode={isEditMode}
                  onRemove={() => handleRemoveWidget(widget.id)}
                />
              </div>
            ))}
          </GridLayout>
        </div>
      </div>

      {/* Edit Mode Help Text */}
      {isEditMode && (
        <div className="mt-4 px-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">✨ Edit Mode Active</p>
            <p className="text-xs">
              <strong>Drag:</strong> Click and hold anywhere on a widget, then drag to rearrange. 
              <strong>Resize:</strong> Drag the bottom-right corner. 
              <strong>Remove:</strong> Click the ✕ button. 
              Don&apos;t forget to save your changes!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

