/**
 * Dashboard Types
 * Type definitions for the modular dashboard grid system
 */

import { Layout } from 'react-grid-layout';

// Widget types available in the dashboard
export type WidgetType = 
  | 'chart' 
  | 'transactions' 
  | 'goals' 
  | 'portfolio' 
  | 'dca'
  | 'timeframe'
  | 'monthly'
  | 'auto-dca'
  | 'wallet-distribution';

// Grid layout item (extends react-grid-layout's Layout)
export interface LayoutItem extends Layout {
  i: string;        // Widget ID
  x: number;        // X position in grid
  y: number;        // Y position in grid
  w: number;        // Width in grid columns
  h: number;        // Height in grid rows
  minW?: number;    // Minimum width
  maxW?: number;    // Maximum width
  minH?: number;    // Minimum height
  maxH?: number;    // Maximum height
  static?: boolean; // Cannot be moved or resized
}

// Widget definition (metadata about each widget type)
export interface WidgetDefinition {
  id: string;
  type: WidgetType;
  title: string;
  icon: string;
  description: string;
  minW: number;        // Minimum width in columns
  minH: number;        // Minimum height in rows
  defaultW: number;    // Default width
  defaultH: number;    // Default height
  category?: string;   // Category for grouping widgets
}

// Widget instance (what's actually displayed)
export interface WidgetInstance {
  id: string;          // Unique instance ID
  type: WidgetType;    // Widget type
  x: number;           // X position
  y: number;           // Y position
  w: number;           // Width
  h: number;           // Height
  visible?: boolean;   // Is widget visible (for add/remove functionality)
}

// Complete dashboard layout
export interface DashboardLayout {
  widgets: WidgetInstance[];
}

// Widget component props
export interface WidgetProps {
  id: string;
  isEditMode?: boolean;
  onRemove?: () => void;
  onRefresh?: () => void;
}

// Dashboard state for edit mode
export interface DashboardState {
  isEditMode: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  layout: DashboardLayout;
}

// API response types
export interface LayoutApiResponse {
  success: boolean;
  data?: DashboardLayout;
  error?: string;
}

export interface SaveLayoutRequest {
  layout: DashboardLayout;
}

export interface SaveLayoutResponse {
  success: boolean;
  message?: string;
  error?: string;
}

