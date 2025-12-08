// Theme presets with HSL values
// Format: "H S% L%" for CSS hsl() function

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  mode: 'light' | 'dark';
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    input: string;
    ring: string;
    sidebar: string;
    sidebarForeground: string;
    sidebarBorder: string;
  };
}

// ============================================
// LIGHT THEME PRESETS
// ============================================

export const LIGHT_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'pure-light',
    name: 'Pure Light',
    description: 'Clean white, default',
    mode: 'light',
    colors: {
      background: '0 0% 100%',           // #ffffff
      foreground: '0 0% 9%',             // #171717
      card: '0 0% 100%',
      cardForeground: '0 0% 9%',
      popover: '0 0% 100%',
      popoverForeground: '0 0% 9%',
      primary: '24 94% 53%',             // Bitcoin orange
      primaryForeground: '0 0% 100%',
      secondary: '0 0% 96%',             // #f5f5f5
      secondaryForeground: '0 0% 9%',
      muted: '0 0% 96%',
      mutedForeground: '0 0% 45%',
      accent: '0 0% 96%',
      accentForeground: '0 0% 9%',
      border: '0 0% 90%',                // #e5e5e5
      input: '0 0% 90%',
      ring: '24 94% 53%',
      sidebar: '0 0% 98%',
      sidebarForeground: '0 0% 9%',
      sidebarBorder: '0 0% 90%',
    },
  },
  {
    id: 'warm-light',
    name: 'Warm Light',
    description: 'Cream, easy on eyes',
    mode: 'light',
    colors: {
      background: '40 30% 98%',          // Warm off-white
      foreground: '30 10% 15%',
      card: '40 25% 99%',
      cardForeground: '30 10% 15%',
      popover: '40 25% 99%',
      popoverForeground: '30 10% 15%',
      primary: '24 94% 53%',
      primaryForeground: '0 0% 100%',
      secondary: '40 20% 94%',
      secondaryForeground: '30 10% 15%',
      muted: '40 20% 94%',
      mutedForeground: '30 10% 40%',
      accent: '40 20% 94%',
      accentForeground: '30 10% 15%',
      border: '40 15% 88%',
      input: '40 15% 88%',
      ring: '24 94% 53%',
      sidebar: '40 25% 96%',
      sidebarForeground: '30 10% 15%',
      sidebarBorder: '40 15% 88%',
    },
  },
  {
    id: 'cool-light',
    name: 'Cool Light',
    description: 'Slight blue tint',
    mode: 'light',
    colors: {
      background: '210 20% 99%',         // Cool blue-white
      foreground: '215 20% 15%',
      card: '210 15% 100%',
      cardForeground: '215 20% 15%',
      popover: '210 15% 100%',
      popoverForeground: '215 20% 15%',
      primary: '24 94% 53%',
      primaryForeground: '0 0% 100%',
      secondary: '210 15% 95%',
      secondaryForeground: '215 20% 15%',
      muted: '210 15% 95%',
      mutedForeground: '215 15% 45%',
      accent: '210 15% 95%',
      accentForeground: '215 20% 15%',
      border: '210 15% 90%',
      input: '210 15% 90%',
      ring: '24 94% 53%',
      sidebar: '210 15% 97%',
      sidebarForeground: '215 20% 15%',
      sidebarBorder: '210 15% 90%',
    },
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Soft sepia, book-like',
    mode: 'light',
    colors: {
      background: '45 30% 96%',          // Paper/parchment
      foreground: '30 15% 20%',
      card: '45 25% 98%',
      cardForeground: '30 15% 20%',
      popover: '45 25% 98%',
      popoverForeground: '30 15% 20%',
      primary: '24 94% 53%',
      primaryForeground: '0 0% 100%',
      secondary: '45 20% 92%',
      secondaryForeground: '30 15% 20%',
      muted: '45 20% 92%',
      mutedForeground: '30 10% 45%',
      accent: '45 20% 92%',
      accentForeground: '30 15% 20%',
      border: '45 15% 85%',
      input: '45 15% 85%',
      ring: '24 94% 53%',
      sidebar: '45 25% 94%',
      sidebarForeground: '30 15% 20%',
      sidebarBorder: '45 15% 85%',
    },
  },
  {
    id: 'high-contrast-light',
    name: 'High Contrast',
    description: 'Maximum readability',
    mode: 'light',
    colors: {
      background: '0 0% 100%',           // Pure white
      foreground: '0 0% 0%',             // Pure black
      card: '0 0% 100%',
      cardForeground: '0 0% 0%',
      popover: '0 0% 100%',
      popoverForeground: '0 0% 0%',
      primary: '24 94% 45%',             // Slightly darker orange
      primaryForeground: '0 0% 100%',
      secondary: '0 0% 95%',
      secondaryForeground: '0 0% 0%',
      muted: '0 0% 95%',
      mutedForeground: '0 0% 30%',
      accent: '0 0% 95%',
      accentForeground: '0 0% 0%',
      border: '0 0% 80%',
      input: '0 0% 80%',
      ring: '24 94% 45%',
      sidebar: '0 0% 98%',
      sidebarForeground: '0 0% 0%',
      sidebarBorder: '0 0% 80%',
    },
  },
];

// ============================================
// DARK THEME PRESETS
// ============================================

export const DARK_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'pure-dark',
    name: 'Pure Dark',
    description: 'True black, neutral tones',
    mode: 'dark',
    colors: {
      background: '0 0% 4%',           // #0a0a0a
      foreground: '0 0% 95%',          // #f2f2f2
      card: '0 0% 7%',                 // #121212
      cardForeground: '0 0% 95%',
      popover: '0 0% 7%',
      popoverForeground: '0 0% 95%',
      primary: '24 95% 55%',           // Bitcoin orange
      primaryForeground: '0 0% 100%',
      secondary: '0 0% 12%',           // #1f1f1f
      secondaryForeground: '0 0% 95%',
      muted: '0 0% 12%',
      mutedForeground: '0 0% 55%',
      accent: '0 0% 12%',
      accentForeground: '0 0% 95%',
      border: '0 0% 15%',              // #262626
      input: '0 0% 15%',
      ring: '24 95% 55%',
      sidebar: '0 0% 5%',
      sidebarForeground: '0 0% 95%',
      sidebarBorder: '0 0% 15%',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Classic dark blue tint',
    mode: 'dark',
    colors: {
      background: '222 20% 7%',        // Dark blue-black
      foreground: '210 20% 95%',
      card: '222 18% 10%',
      cardForeground: '210 20% 95%',
      popover: '222 18% 10%',
      popoverForeground: '210 20% 95%',
      primary: '24 95% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '222 15% 14%',
      secondaryForeground: '210 20% 95%',
      muted: '222 15% 14%',
      mutedForeground: '215 15% 55%',
      accent: '222 15% 14%',
      accentForeground: '210 20% 95%',
      border: '222 15% 18%',
      input: '222 15% 18%',
      ring: '24 95% 55%',
      sidebar: '222 20% 6%',
      sidebarForeground: '210 20% 95%',
      sidebarBorder: '222 15% 18%',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    description: 'Arctic, cool blue-gray',
    mode: 'dark',
    colors: {
      background: '220 16% 18%',       // #2e3440
      foreground: '219 28% 88%',       // #d8dee9
      card: '220 17% 22%',             // #3b4252
      cardForeground: '219 28% 88%',
      popover: '220 17% 22%',
      popoverForeground: '219 28% 88%',
      primary: '24 95% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '220 16% 28%',        // #434c5e
      secondaryForeground: '219 28% 88%',
      muted: '220 16% 28%',
      mutedForeground: '219 14% 63%',
      accent: '220 16% 28%',
      accentForeground: '219 28% 88%',
      border: '220 16% 32%',           // #4c566a
      input: '220 16% 32%',
      ring: '24 95% 55%',
      sidebar: '220 16% 16%',
      sidebarForeground: '219 28% 88%',
      sidebarBorder: '220 16% 32%',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    description: 'Popular purple-tinted theme',
    mode: 'dark',
    colors: {
      background: '231 15% 18%',       // #282a36
      foreground: '60 30% 96%',        // #f8f8f2
      card: '232 14% 23%',             // #343746 slightly lighter
      cardForeground: '60 30% 96%',
      popover: '232 14% 23%',
      popoverForeground: '60 30% 96%',
      primary: '24 95% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '231 15% 28%',        // #44475a
      secondaryForeground: '60 30% 96%',
      muted: '231 15% 28%',
      mutedForeground: '225 27% 51%',  // #6272a4
      accent: '231 15% 28%',
      accentForeground: '60 30% 96%',
      border: '231 15% 32%',
      input: '231 15% 32%',
      ring: '24 95% 55%',
      sidebar: '231 15% 15%',
      sidebarForeground: '60 30% 96%',
      sidebarBorder: '231 15% 32%',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    description: 'Atom editor inspired',
    mode: 'dark',
    colors: {
      background: '220 13% 18%',       // #282c34
      foreground: '219 14% 71%',       // #abb2bf
      card: '220 13% 22%',
      cardForeground: '219 14% 76%',
      popover: '220 13% 22%',
      popoverForeground: '219 14% 76%',
      primary: '24 95% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '220 13% 26%',
      secondaryForeground: '219 14% 76%',
      muted: '220 13% 26%',
      mutedForeground: '219 10% 53%',  // #5c6370
      accent: '220 13% 26%',
      accentForeground: '219 14% 76%',
      border: '220 13% 30%',           // #4b5263
      input: '220 13% 30%',
      ring: '24 95% 55%',
      sidebar: '220 13% 15%',
      sidebarForeground: '219 14% 76%',
      sidebarBorder: '220 13% 30%',
    },
  },
  {
    id: 'oled-black',
    name: 'OLED Black',
    description: 'Pure black for OLED screens',
    mode: 'dark',
    colors: {
      background: '0 0% 0%',           // #000000
      foreground: '0 0% 95%',
      card: '0 0% 5%',                 // #0d0d0d
      cardForeground: '0 0% 95%',
      popover: '0 0% 5%',
      popoverForeground: '0 0% 95%',
      primary: '24 95% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '0 0% 8%',
      secondaryForeground: '0 0% 95%',
      muted: '0 0% 8%',
      mutedForeground: '0 0% 50%',
      accent: '0 0% 8%',
      accentForeground: '0 0% 95%',
      border: '0 0% 12%',
      input: '0 0% 12%',
      ring: '24 95% 55%',
      sidebar: '0 0% 0%',
      sidebarForeground: '0 0% 95%',
      sidebarBorder: '0 0% 12%',
    },
  },
  {
    id: 'warm-dark',
    name: 'Warm Dark',
    description: 'Cozy, warm undertones',
    mode: 'dark',
    colors: {
      background: '30 8% 6%',          // Warm dark brown-black
      foreground: '35 20% 92%',
      card: '30 8% 9%',
      cardForeground: '35 20% 92%',
      popover: '30 8% 9%',
      popoverForeground: '35 20% 92%',
      primary: '24 95% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '30 8% 13%',
      secondaryForeground: '35 20% 92%',
      muted: '30 8% 13%',
      mutedForeground: '30 10% 50%',
      accent: '30 8% 13%',
      accentForeground: '35 20% 92%',
      border: '30 8% 17%',
      input: '30 8% 17%',
      ring: '24 95% 55%',
      sidebar: '30 8% 5%',
      sidebarForeground: '35 20% 92%',
      sidebarBorder: '30 8% 17%',
    },
  },
];

export const DEFAULT_DARK_THEME_ID = 'pure-dark';
export const DEFAULT_LIGHT_THEME_ID = 'pure-light';

const DARK_STORAGE_KEY = 'btc-tracker-dark-theme';
const LIGHT_STORAGE_KEY = 'btc-tracker-light-theme';

export function getThemePreset(id: string, mode: 'light' | 'dark'): ThemePreset | undefined {
  const presets = mode === 'dark' ? DARK_THEME_PRESETS : LIGHT_THEME_PRESETS;
  return presets.find(theme => theme.id === id);
}

export function applyThemePreset(preset: ThemePreset): void {
  const root = document.documentElement;
  
  // Apply each color variable (trust the caller to call at the right time)
  Object.entries(preset.colors).forEach(([key, value]) => {
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssVar, value);
  });
  
  // Store preference
  const storageKey = preset.mode === 'dark' ? DARK_STORAGE_KEY : LIGHT_STORAGE_KEY;
  localStorage.setItem(storageKey, preset.id);
}

export function loadSavedThemePreset(mode: 'light' | 'dark'): string {
  if (typeof window === 'undefined') {
    return mode === 'dark' ? DEFAULT_DARK_THEME_ID : DEFAULT_LIGHT_THEME_ID;
  }
  const storageKey = mode === 'dark' ? DARK_STORAGE_KEY : LIGHT_STORAGE_KEY;
  const defaultId = mode === 'dark' ? DEFAULT_DARK_THEME_ID : DEFAULT_LIGHT_THEME_ID;
  return localStorage.getItem(storageKey) || defaultId;
}

export function clearThemePresetOverrides(): void {
  const root = document.documentElement;
  const preset = DARK_THEME_PRESETS[0]; // Use first preset to get all keys
  
  Object.keys(preset.colors).forEach((key) => {
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.removeProperty(cssVar);
  });
}
