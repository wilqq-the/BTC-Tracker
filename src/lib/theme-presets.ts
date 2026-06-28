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
      primary: '33 92% 50%',             // Bitcoin orange
      primaryForeground: '0 0% 100%',
      secondary: '0 0% 96%',             // #f5f5f5
      secondaryForeground: '0 0% 9%',
      muted: '0 0% 96%',
      mutedForeground: '0 0% 45%',
      accent: '0 0% 96%',
      accentForeground: '0 0% 9%',
      border: '0 0% 90%',                // #e5e5e5
      input: '0 0% 90%',
      ring: '33 92% 50%',
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
      primary: '33 92% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '40 20% 94%',
      secondaryForeground: '30 10% 15%',
      muted: '40 20% 94%',
      mutedForeground: '30 10% 40%',
      accent: '40 20% 94%',
      accentForeground: '30 10% 15%',
      border: '40 15% 88%',
      input: '40 15% 88%',
      ring: '33 92% 50%',
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
      primary: '33 92% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '210 15% 95%',
      secondaryForeground: '215 20% 15%',
      muted: '210 15% 95%',
      mutedForeground: '215 15% 45%',
      accent: '210 15% 95%',
      accentForeground: '215 20% 15%',
      border: '210 15% 90%',
      input: '210 15% 90%',
      ring: '33 92% 50%',
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
      primary: '33 92% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '45 20% 92%',
      secondaryForeground: '30 15% 20%',
      muted: '45 20% 92%',
      mutedForeground: '30 10% 45%',
      accent: '45 20% 92%',
      accentForeground: '30 15% 20%',
      border: '45 15% 85%',
      input: '45 15% 85%',
      ring: '33 92% 50%',
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
      primary: '33 92% 46%',             // Slightly darker orange
      primaryForeground: '0 0% 100%',
      secondary: '0 0% 95%',
      secondaryForeground: '0 0% 0%',
      muted: '0 0% 95%',
      mutedForeground: '0 0% 30%',
      accent: '0 0% 95%',
      accentForeground: '0 0% 0%',
      border: '0 0% 80%',
      input: '0 0% 80%',
      ring: '33 92% 46%',
      sidebar: '0 0% 98%',
      sidebarForeground: '0 0% 0%',
      sidebarBorder: '0 0% 80%',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    description: 'Warm cream with blue/cyan accent',
    mode: 'light',
    colors: {
      background: '44 87% 94%',          // #fdf6e3 base3
      foreground: '192 81% 14%',         // #073642 base02
      card: '46 56% 90%',                // #eee8d5 base2
      cardForeground: '192 81% 14%',
      popover: '44 70% 92%',
      popoverForeground: '192 81% 14%',
      primary: '205 69% 49%',            // #268bd2 blue
      primaryForeground: '44 87% 96%',
      secondary: '46 42% 86%',
      secondaryForeground: '194 14% 30%',
      muted: '46 42% 86%',
      mutedForeground: '196 13% 45%',    // #657b83 base00
      accent: '175 45% 82%',             // #2aa198 cyan, lightened
      accentForeground: '194 25% 22%',
      border: '46 33% 80%',
      input: '46 33% 80%',
      ring: '205 69% 49%',
      sidebar: '46 56% 91%',
      sidebarForeground: '192 81% 14%',
      sidebarBorder: '46 33% 80%',
    },
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    description: 'Soft gray-white with mauve accent',
    mode: 'light',
    colors: {
      background: '220 23% 95%',         // #eff1f5 base
      foreground: '234 16% 35%',         // #4c4f69 text
      card: '220 23% 98%',
      cardForeground: '234 16% 35%',
      popover: '220 23% 98%',
      popoverForeground: '234 16% 35%',
      primary: '266 85% 58%',            // #8839ef mauve
      primaryForeground: '0 0% 100%',
      secondary: '223 16% 90%',          // #ccd0da surface0
      secondaryForeground: '234 16% 30%',
      muted: '223 16% 90%',
      mutedForeground: '233 10% 47%',    // #7c7f93 overlay
      accent: '266 60% 90%',             // light mauve tint
      accentForeground: '234 16% 25%',
      border: '223 16% 85%',
      input: '223 16% 85%',
      ring: '266 85% 58%',
      sidebar: '220 23% 97%',
      sidebarForeground: '234 16% 35%',
      sidebarBorder: '223 16% 85%',
    },
  },
  {
    id: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn',
    description: 'Warm off-white with dusty rose accent',
    mode: 'light',
    colors: {
      background: '32 57% 95%',          // #faf4ed base
      foreground: '249 18% 40%',         // #575279 text
      card: '35 60% 98%',                // #fffaf3 surface
      cardForeground: '249 18% 40%',
      popover: '35 60% 98%',
      popoverForeground: '249 18% 40%',
      primary: '343 35% 48%',            // #b4637a love, deepened
      primaryForeground: '0 0% 100%',
      secondary: '30 42% 90%',
      secondaryForeground: '249 18% 35%',
      muted: '30 42% 90%',
      mutedForeground: '248 12% 52%',    // #9893a5 muted
      accent: '343 50% 90%',             // light rose tint
      accentForeground: '249 18% 30%',
      border: '30 30% 86%',
      input: '30 30% 86%',
      ring: '343 35% 48%',
      sidebar: '32 57% 93%',
      sidebarForeground: '249 18% 40%',
      sidebarBorder: '30 30% 86%',
    },
  },
  {
    id: 'sage-mint',
    name: 'Sage Mint',
    description: 'Pale mint with emerald-green accent',
    mode: 'light',
    colors: {
      background: '150 25% 96%',         // pale mint
      foreground: '160 25% 16%',
      card: '150 30% 99%',
      cardForeground: '160 25% 16%',
      popover: '150 30% 99%',
      popoverForeground: '160 25% 16%',
      primary: '160 84% 32%',            // #059669 emerald
      primaryForeground: '0 0% 100%',
      secondary: '150 20% 90%',
      secondaryForeground: '160 25% 18%',
      muted: '150 20% 90%',
      mutedForeground: '155 12% 42%',
      accent: '160 45% 88%',             // light mint tint
      accentForeground: '160 25% 18%',
      border: '150 18% 84%',
      input: '150 18% 84%',
      ring: '160 84% 32%',
      sidebar: '150 25% 94%',
      sidebarForeground: '160 25% 16%',
      sidebarBorder: '150 18% 84%',
    },
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    description: 'Clean white with GitHub blue accent',
    mode: 'light',
    colors: {
      background: '0 0% 100%',           // #ffffff
      foreground: '213 13% 16%',         // #1f2328
      card: '0 0% 100%',
      cardForeground: '213 13% 16%',
      popover: '0 0% 100%',
      popoverForeground: '213 13% 16%',
      primary: '212 92% 45%',            // #0969da blue
      primaryForeground: '0 0% 100%',
      secondary: '210 29% 97%',          // #f6f8fa
      secondaryForeground: '213 13% 16%',
      muted: '210 29% 97%',
      mutedForeground: '215 8% 43%',     // #656d76
      accent: '212 60% 94%',             // light blue tint
      accentForeground: '212 92% 30%',
      border: '213 17% 84%',             // #d0d7de
      input: '213 17% 84%',
      ring: '212 92% 45%',
      sidebar: '210 29% 98%',
      sidebarForeground: '213 13% 16%',
      sidebarBorder: '213 17% 84%',
    },
  },
  {
    id: 'whitepaper',
    name: 'Whitepaper',
    description: 'Sepia parchment — a Satoshi wink',
    mode: 'light',
    colors: {
      background: '43 50% 90%',          // parchment #f4ecd8
      foreground: '35 33% 18%',          // dark sepia ink
      card: '43 55% 94%',
      cardForeground: '35 33% 18%',
      popover: '43 55% 94%',
      popoverForeground: '35 33% 18%',
      primary: '32 45% 42%',             // sepia brown-gold
      primaryForeground: '43 50% 95%',
      secondary: '42 35% 85%',
      secondaryForeground: '35 33% 22%',
      muted: '42 35% 85%',
      mutedForeground: '36 18% 42%',
      accent: '40 40% 82%',              // warm tint
      accentForeground: '35 33% 22%',
      border: '40 28% 78%',
      input: '40 28% 78%',
      ring: '32 45% 42%',
      sidebar: '43 50% 88%',
      sidebarForeground: '35 33% 18%',
      sidebarBorder: '40 28% 78%',
    },
  },
];

// ============================================
// DARK THEME PRESETS
// ============================================

export const DARK_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'pure-dark',
    name: 'Vault Dark',
    description: 'Deep cool charcoal with gold',
    mode: 'dark',
    colors: {
      background: '240 8% 5%',         // cool-tinted charcoal (depth)
      foreground: '240 10% 96%',
      card: '240 7% 8%',
      cardForeground: '240 10% 96%',
      popover: '240 7% 9%',
      popoverForeground: '240 10% 96%',
      primary: '33 96% 56%',           // Bitcoin gold
      primaryForeground: '0 0% 100%',
      secondary: '240 6% 13%',
      secondaryForeground: '240 10% 96%',
      muted: '240 6% 13%',
      mutedForeground: '240 5% 60%',
      accent: '240 6% 14%',
      accentForeground: '240 10% 96%',
      border: '240 6% 16%',
      input: '240 6% 16%',
      ring: '33 96% 56%',
      sidebar: '240 9% 6%',
      sidebarForeground: '240 10% 96%',
      sidebarBorder: '240 6% 16%',
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
      primary: '33 96% 56%',
      primaryForeground: '0 0% 100%',
      secondary: '222 15% 14%',
      secondaryForeground: '210 20% 95%',
      muted: '222 15% 14%',
      mutedForeground: '215 15% 55%',
      accent: '222 15% 14%',
      accentForeground: '210 20% 95%',
      border: '222 15% 18%',
      input: '222 15% 18%',
      ring: '33 96% 56%',
      sidebar: '222 20% 6%',
      sidebarForeground: '210 20% 95%',
      sidebarBorder: '222 15% 18%',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    description: 'Arctic slate with icy frost-blue accent',
    mode: 'dark',
    colors: {
      background: '220 16% 16%',       // #2e3440 polar night
      foreground: '218 27% 88%',       // #d8dee9 snow storm
      card: '220 16% 20%',             // #3b4252
      cardForeground: '218 27% 88%',
      popover: '220 16% 19%',
      popoverForeground: '218 27% 88%',
      primary: '193 43% 67%',          // #88c0d0 frost
      primaryForeground: '220 28% 14%',
      secondary: '220 16% 24%',        // #434c5e
      secondaryForeground: '218 27% 88%',
      muted: '220 16% 24%',
      mutedForeground: '220 12% 64%',
      accent: '213 32% 30%',           // deep frost blue
      accentForeground: '218 33% 92%',
      border: '220 16% 28%',           // #4c566a
      input: '220 16% 28%',
      ring: '193 43% 67%',
      sidebar: '220 17% 14%',
      sidebarForeground: '218 27% 88%',
      sidebarBorder: '220 16% 26%',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    description: 'Deep charcoal with purple + pink accent',
    mode: 'dark',
    colors: {
      background: '231 15% 18%',       // #282a36
      foreground: '60 30% 96%',        // #f8f8f2
      card: '232 15% 22%',
      cardForeground: '60 30% 96%',
      popover: '232 15% 21%',
      popoverForeground: '60 30% 96%',
      primary: '265 89% 78%',          // #bd93f9 purple
      primaryForeground: '231 15% 15%',
      secondary: '232 14% 28%',        // #44475a
      secondaryForeground: '60 30% 96%',
      muted: '232 14% 28%',
      mutedForeground: '231 15% 72%',
      accent: '326 45% 38%',           // #ff79c6 pink, deepened
      accentForeground: '60 30% 96%',
      border: '232 14% 31%',
      input: '232 14% 31%',
      ring: '265 89% 78%',
      sidebar: '231 15% 15%',
      sidebarForeground: '60 30% 96%',
      sidebarBorder: '232 14% 28%',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: 'Midnight navy with blue/indigo accent',
    mode: 'dark',
    colors: {
      background: '230 23% 13%',       // #1a1b26
      foreground: '229 64% 86%',       // #c0caf5
      card: '230 22% 17%',
      cardForeground: '229 64% 86%',
      popover: '230 22% 16%',
      popoverForeground: '229 64% 86%',
      primary: '221 87% 72%',          // #7aa2f7 blue
      primaryForeground: '230 30% 12%',
      secondary: '230 20% 22%',
      secondaryForeground: '229 64% 86%',
      muted: '230 20% 22%',
      mutedForeground: '229 24% 64%',
      accent: '261 50% 32%',           // #bb9af7 purple, deepened
      accentForeground: '229 64% 90%',
      border: '230 20% 24%',
      input: '230 20% 24%',
      ring: '221 87% 72%',
      sidebar: '230 24% 11%',
      sidebarForeground: '229 64% 86%',
      sidebarBorder: '230 20% 22%',
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    description: 'Soft plum-black with mauve accent',
    mode: 'dark',
    colors: {
      background: '240 21% 15%',       // #1e1e2e
      foreground: '226 64% 88%',       // #cdd6f4
      card: '240 18% 19%',
      cardForeground: '226 64% 88%',
      popover: '240 18% 18%',
      popoverForeground: '226 64% 88%',
      primary: '267 84% 81%',          // #cba6f7 mauve
      primaryForeground: '240 21% 14%',
      secondary: '240 13% 25%',
      secondaryForeground: '226 64% 88%',
      muted: '240 13% 25%',
      mutedForeground: '228 13% 64%',
      accent: '267 40% 34%',
      accentForeground: '226 64% 90%',
      border: '240 13% 27%',
      input: '240 13% 27%',
      ring: '267 84% 81%',
      sidebar: '240 21% 12%',
      sidebarForeground: '226 64% 88%',
      sidebarBorder: '240 13% 25%',
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon magenta on deep indigo-black',
    mode: 'dark',
    colors: {
      background: '258 45% 8%',        // deep indigo-black
      foreground: '187 80% 92%',       // icy neon white
      card: '258 38% 12%',
      cardForeground: '187 80% 92%',
      popover: '258 38% 11%',
      popoverForeground: '187 80% 92%',
      primary: '330 100% 60%',         // neon magenta
      primaryForeground: '0 0% 100%',
      secondary: '258 32% 18%',
      secondaryForeground: '187 70% 90%',
      muted: '258 32% 18%',
      mutedForeground: '255 25% 68%',
      accent: '187 90% 22%',           // neon cyan, deepened
      accentForeground: '187 90% 90%',
      border: '282 45% 26%',
      input: '282 45% 26%',
      ring: '330 100% 60%',
      sidebar: '260 50% 6%',
      sidebarForeground: '187 80% 92%',
      sidebarBorder: '282 45% 24%',
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    description: 'Retro warm — amber on brown-black',
    mode: 'dark',
    colors: {
      background: '20 6% 16%',          // #282828
      foreground: '45 33% 81%',         // #ebdbb2
      card: '24 6% 20%',
      cardForeground: '45 33% 81%',
      popover: '24 6% 19%',
      popoverForeground: '45 33% 81%',
      primary: '42 96% 58%',            // #fabd2f yellow
      primaryForeground: '20 10% 14%',
      secondary: '24 6% 24%',
      secondaryForeground: '45 33% 81%',
      muted: '24 6% 24%',
      mutedForeground: '45 13% 58%',    // #a89984
      accent: '61 30% 26%',             // olive tint
      accentForeground: '45 33% 85%',
      border: '24 7% 30%',              // #504945
      input: '24 7% 30%',
      ring: '42 96% 58%',
      sidebar: '20 8% 12%',             // #1d2021
      sidebarForeground: '45 33% 81%',
      sidebarBorder: '24 7% 28%',
    },
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    description: 'Muted rose + iris on soft night',
    mode: 'dark',
    colors: {
      background: '249 23% 12%',        // #191724 base
      foreground: '245 50% 91%',        // #e0def4 text
      card: '248 24% 15%',              // #1f1d2e surface
      cardForeground: '245 50% 91%',
      popover: '248 24% 16%',
      popoverForeground: '245 50% 91%',
      primary: '343 76% 68%',           // #eb6f92 love
      primaryForeground: '249 23% 12%',
      secondary: '248 24% 18%',         // #26233a overlay
      secondaryForeground: '245 50% 91%',
      muted: '248 24% 18%',
      mutedForeground: '249 12% 62%',   // #6e6a86
      accent: '267 40% 30%',            // #c4a7e7 iris, deepened
      accentForeground: '245 50% 92%',
      border: '248 24% 22%',
      input: '248 24% 22%',
      ring: '343 76% 68%',
      sidebar: '249 24% 10%',
      sidebarForeground: '245 50% 91%',
      sidebarBorder: '248 24% 20%',
    },
  },
  {
    id: 'everforest',
    name: 'Everforest',
    description: 'Soft, low-contrast forest green',
    mode: 'dark',
    colors: {
      background: '200 13% 16%',        // #272e33 hard
      foreground: '39 26% 75%',         // #d3c6aa
      card: '195 11% 20%',              // #2d353b
      cardForeground: '39 26% 75%',
      popover: '195 11% 19%',
      popoverForeground: '39 26% 75%',
      primary: '88 28% 63%',            // #a7c080 green
      primaryForeground: '200 18% 14%',
      secondary: '195 10% 24%',
      secondaryForeground: '39 26% 75%',
      muted: '195 10% 24%',
      mutedForeground: '39 8% 60%',     // #859289
      accent: '174 25% 28%',            // #7fbbb3 blue-aqua, deepened
      accentForeground: '39 26% 80%',
      border: '195 9% 27%',
      input: '195 9% 27%',
      ring: '88 28% 63%',
      sidebar: '200 14% 13%',
      sidebarForeground: '39 26% 75%',
      sidebarBorder: '195 9% 25%',
    },
  },
  {
    id: 'matrix',
    name: 'Matrix',
    description: 'Phosphor green on black — terminal vibe',
    mode: 'dark',
    colors: {
      background: '0 0% 2%',            // near-black
      foreground: '135 80% 70%',        // soft phosphor green
      card: '140 30% 6%',
      cardForeground: '135 80% 70%',
      popover: '140 30% 6%',
      popoverForeground: '135 80% 70%',
      primary: '135 100% 50%',          // #00ff41 phosphor
      primaryForeground: '0 0% 4%',
      secondary: '140 25% 12%',
      secondaryForeground: '135 80% 75%',
      muted: '140 25% 12%',
      mutedForeground: '135 30% 55%',
      accent: '135 60% 18%',
      accentForeground: '135 90% 80%',
      border: '140 40% 16%',
      input: '140 40% 16%',
      ring: '135 100% 50%',
      sidebar: '0 0% 0%',
      sidebarForeground: '135 80% 70%',
      sidebarBorder: '140 40% 16%',
    },
  },
  {
    id: 'synthwave',
    name: "Synthwave '84",
    description: 'Neon pink + cyan retro sunset',
    mode: 'dark',
    colors: {
      background: '252 24% 16%',        // deep purple #262335
      foreground: '280 30% 92%',
      card: '252 22% 21%',
      cardForeground: '280 30% 92%',
      popover: '252 22% 20%',
      popoverForeground: '280 30% 92%',
      primary: '315 100% 75%',          // #ff7edb hot pink
      primaryForeground: '260 30% 14%',
      secondary: '252 20% 26%',
      secondaryForeground: '280 30% 92%',
      muted: '252 20% 26%',
      mutedForeground: '265 20% 70%',
      accent: '186 95% 40%',            // #03edf9 cyan, deepened
      accentForeground: '186 90% 92%',
      border: '280 35% 30%',
      input: '280 35% 30%',
      ring: '315 100% 75%',
      sidebar: '255 28% 12%',
      sidebarForeground: '280 30% 92%',
      sidebarBorder: '280 35% 28%',
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
      primary: '33 96% 56%',
      primaryForeground: '0 0% 100%',
      secondary: '220 13% 26%',
      secondaryForeground: '219 14% 76%',
      muted: '220 13% 26%',
      mutedForeground: '219 10% 53%',  // #5c6370
      accent: '220 13% 26%',
      accentForeground: '219 14% 76%',
      border: '220 13% 30%',           // #4b5263
      input: '220 13% 30%',
      ring: '33 96% 56%',
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
      primary: '33 96% 56%',
      primaryForeground: '0 0% 100%',
      secondary: '0 0% 8%',
      secondaryForeground: '0 0% 95%',
      muted: '0 0% 8%',
      mutedForeground: '0 0% 50%',
      accent: '0 0% 8%',
      accentForeground: '0 0% 95%',
      border: '0 0% 12%',
      input: '0 0% 12%',
      ring: '33 96% 56%',
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
      primary: '33 96% 56%',
      primaryForeground: '0 0% 100%',
      secondary: '30 8% 13%',
      secondaryForeground: '35 20% 92%',
      muted: '30 8% 13%',
      mutedForeground: '30 10% 50%',
      accent: '30 8% 13%',
      accentForeground: '35 20% 92%',
      border: '30 8% 17%',
      input: '30 8% 17%',
      ring: '33 96% 56%',
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
