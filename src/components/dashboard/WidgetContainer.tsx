'use client';

import React from 'react';
import { WidgetType, WidgetProps } from '@/lib/dashboard-types';
import { getWidgetComponent } from './WidgetRegistry';
import { getWidgetDefinitionById } from '@/lib/dashboard-constants';

interface WidgetContainerProps {
  id: string;
  type: WidgetType;
  isEditMode: boolean;
  onRemove?: () => void;
}

/**
 * Widget Container
 * Wraps each widget with a container that provides common functionality
 */
export default function WidgetContainer({ 
  id, 
  type, 
  isEditMode, 
  onRemove 
}: WidgetContainerProps) {
  const WidgetComponent = getWidgetComponent(type);
  const widgetDef = getWidgetDefinitionById(id);

  if (!WidgetComponent) {
    return (
      <div className="h-full w-full bg-red-100 dark:bg-red-900 rounded-lg p-4 flex items-center justify-center">
        <p className="text-red-800 dark:text-red-200 text-sm">
          Unknown widget type: {type}
        </p>
      </div>
    );
  }

  const widgetProps: WidgetProps = {
    id,
    isEditMode,
    onRemove,
  };

  return (
    <div className={`h-full w-full relative bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${
      isEditMode ? 'hover:shadow-lg transition-shadow' : ''
    }`}>
      {/* Edit Mode Overlay */}
      {isEditMode && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-orange-500/10 border-b border-orange-500/50 px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-move drag-handle flex-1">
            <span className="text-base select-none">⋮⋮</span>
            <span className="text-xs font-mono text-orange-600 dark:text-orange-400 select-none">
              {widgetDef?.icon} {widgetDef?.title || id}
            </span>
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-bold cursor-pointer px-2 py-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Remove widget"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Widget Content */}
      <div className={`h-full w-full p-4 ${isEditMode ? 'pt-10' : ''}`}>
        <WidgetComponent {...widgetProps} />
      </div>

      {/* Resize Handle Indicator (visible only in edit mode) */}
      {isEditMode && (
        <div className="absolute bottom-1 right-1 pointer-events-none">
          <div className="text-gray-400 dark:text-gray-600 text-sm">
            ⇲
          </div>
        </div>
      )}
    </div>
  );
}

