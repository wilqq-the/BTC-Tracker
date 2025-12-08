'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { 
  DARK_THEME_PRESETS, 
  LIGHT_THEME_PRESETS,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  getThemePreset, 
  applyThemePreset, 
  clearThemePresetOverrides,
  loadSavedThemePreset 
} from '@/lib/theme-presets';

export function useThemePreset() {
  const { resolvedTheme } = useTheme();
  const [darkPresetId, setDarkPresetId] = useState<string>(DEFAULT_DARK_THEME_ID);
  const [lightPresetId, setLightPresetId] = useState<string>(DEFAULT_LIGHT_THEME_ID);
  const [mounted, setMounted] = useState(false);

  // Load saved presets on mount
  useEffect(() => {
    setMounted(true);
    setDarkPresetId(loadSavedThemePreset('dark'));
    setLightPresetId(loadSavedThemePreset('light'));
  }, []);

  // Apply theme when mode changes or when preset changes
  useEffect(() => {
    if (!mounted) return;
    
    // Clear any previous overrides first
    clearThemePresetOverrides();
    
    const isDark = resolvedTheme === 'dark';
    const presetId = isDark ? darkPresetId : lightPresetId;
    const preset = getThemePreset(presetId, isDark ? 'dark' : 'light');
    
    if (preset) {
      applyThemePreset(preset);
    }
  }, [resolvedTheme, darkPresetId, lightPresetId, mounted]);

  const setDarkPreset = useCallback((presetId: string) => {
    const preset = getThemePreset(presetId, 'dark');
    if (preset) {
      setDarkPresetId(presetId);
      localStorage.setItem('btc-tracker-dark-theme', presetId);
      
      // Apply immediately if in dark mode
      if (document.documentElement.classList.contains('dark')) {
        clearThemePresetOverrides();
        applyThemePreset(preset);
      }
    }
  }, []);

  const setLightPreset = useCallback((presetId: string) => {
    const preset = getThemePreset(presetId, 'light');
    if (preset) {
      setLightPresetId(presetId);
      localStorage.setItem('btc-tracker-light-theme', presetId);
      
      // Apply immediately if in light mode
      if (!document.documentElement.classList.contains('dark')) {
        clearThemePresetOverrides();
        applyThemePreset(preset);
      }
    }
  }, []);

  return {
    darkPresetId,
    lightPresetId,
    setDarkPreset,
    setLightPreset,
    darkPresets: DARK_THEME_PRESETS,
    lightPresets: LIGHT_THEME_PRESETS,
    mounted,
  };
}

// Keep the old name as alias for backward compatibility
export const useDarkThemePreset = useThemePreset;
