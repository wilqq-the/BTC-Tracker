'use client';

import React from 'react';
import {
  BarChart3Icon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  CoinsIcon,
  FlameIcon,
  HourglassIcon,
  LightbulbIcon,
  LucideIcon,
  MinusIcon,
  PartyPopperIcon,
  RocketIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TrophyIcon,
} from 'lucide-react';

/**
 * Icon keys returned by the planning services (price scenarios, DCA insights)
 * mapped to lucide icons. Services send a stable key, never an emoji.
 */
const ICONS: Record<string, LucideIcon> = {
  // price scenarios (btc-projection-service)
  'trending-down': TrendingDownIcon,
  shield: ShieldIcon,
  minus: MinusIcon,
  'trending-up': TrendingUpIcon,
  rocket: RocketIcon,
  sliders: SlidersHorizontalIcon,
  // DCA insights (dca-analysis-service)
  party: PartyPopperIcon,
  check: CheckCircle2Icon,
  lightbulb: LightbulbIcon,
  target: TargetIcon,
  calendar: CalendarIcon,
  'bar-chart': BarChart3Icon,
  clock: ClockIcon,
  coins: CoinsIcon,
  sparkles: SparklesIcon,
  trophy: TrophyIcon,
  hourglass: HourglassIcon,
  flame: FlameIcon,
};

/** Scenario ids (stored on goals as `price_scenario`) → icon key */
const SCENARIO_ICON_KEYS: Record<string, string> = {
  bear: 'trending-down',
  conservative: 'shield',
  stable: 'minus',
  moderate: 'trending-up',
  bull: 'rocket',
  custom: 'sliders',
};

/** Sentence-case labels for scenario ids */
export const SCENARIO_NAMES: Record<string, string> = {
  bear: 'Bear market',
  conservative: 'Conservative',
  stable: 'Stable',
  moderate: 'Moderate growth',
  bull: 'Bull market',
  custom: 'Custom',
};

export function PlanningIcon({
  name,
  className,
  fallback = TargetIcon,
}: {
  name?: string;
  className?: string;
  fallback?: LucideIcon;
}) {
  const Icon = (name && ICONS[name]) || fallback;
  return <Icon className={className} aria-hidden />;
}

/** Icon for a scenario, by icon key or by scenario id */
export function ScenarioIcon({ id, icon, className }: { id?: string; icon?: string; className?: string }) {
  const key = icon && ICONS[icon] ? icon : SCENARIO_ICON_KEYS[id ?? ''];
  return <PlanningIcon name={key} className={className} fallback={SlidersHorizontalIcon} />;
}

// ---- small formatting helpers shared by the planning tabs ----

/** Green for gains, red for losses, muted for exactly zero */
export const tone = (n: number) =>
  n > 0 ? 'text-tint-green-fg' : n < 0 ? 'text-tint-red-fg' : 'text-muted-foreground';

/** Sign prefix (formatCurrency drops the minus, so add it back) */
export const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '-' : '');

/** Signed percentage, e.g. +12.3% / -4.0% / 0.0% */
export const pct = (n: number, decimals = 1) => `${sign(n)}${Math.abs(n).toFixed(decimals)}%`;

/** BTC amount without trailing zeros */
export const btc = (n: number) => (n >= 1 ? n.toFixed(4) : n.toFixed(8)).replace(/\.?0+$/, '') || '0';

/** "Bear Market" → "Bear market"; keeps acronyms like DCA */
export const sentenceCase = (text: string) =>
  text
    .split(' ')
    .map((word, i) => (i === 0 || /^[A-Z0-9]{2,}$/.test(word) ? word : word.toLowerCase()))
    .join(' ');
