'use client';

import React, { useState, useEffect } from 'react';
import { ThemedCard, ThemedText } from '@/components/ui/ThemeProvider';
import { WidgetProps } from '@/lib/dashboard-types';

interface Goal {
  id: number;
  name: string;
  target_btc_amount: number;
  target_date: string;
  current_holdings: number;
  monthly_budget: number | null;
  currency: string;
  price_scenario: string;
  scenario_growth_rate: number;
  monthly_fiat_needed: number;
  is_completed: boolean;
  created_at: string;
}

/**
 * Goals Overview Widget
 * Shows a summary of Bitcoin savings goals
 */
export default function GoalsOverviewWidget({ id, isEditMode, onRefresh }: WidgetProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioBtc, setPortfolioBtc] = useState<number>(0);
  const [maxGoals, setMaxGoals] = useState<number>(3);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Calculate how many goals can fit based on container height
  useEffect(() => {
    const calculateMaxGoals = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.offsetHeight;
        // More conservative calculation to avoid overflow
        // Header: ~48px, card padding + bottom margin: ~40px
        // Each goal with divider: ~95px (slightly more than visual height)
        const headerHeight = 48;
        const cardOverhead = 40;
        const goalHeight = 95; // Increased to be more conservative
        const availableHeight = containerHeight - headerHeight - cardOverhead;
        const count = Math.max(2, Math.floor(availableHeight / goalHeight));
        setMaxGoals(Math.min(count, 20)); // Cap at 20 max
      }
    };

    calculateMaxGoals();

    // Recalculate on resize with slight delay to ensure proper measurement
    const observer = new ResizeObserver(() => {
      setTimeout(calculateMaxGoals, 50);
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    loadGoals();
    loadPortfolio();
  }, []);

  const loadGoals = async () => {
    try {
      const response = await fetch('/api/goals');
      const result = await response.json();
      
      if (result.success && result.data) {
        // Show only active (non-completed) goals
        const activeGoals = result.data.filter((g: Goal) => !g.is_completed);
        setGoals(activeGoals);
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio-metrics');
      const result = await response.json();
      
      if (result.success && result.data?.totalBtc !== undefined) {
        setPortfolioBtc(result.data.totalBtc);
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadGoals();
    await loadPortfolio();
    if (onRefresh) onRefresh();
  };

  const calculateProgress = (goal: Goal) => {
    const progress = (portfolioBtc / goal.target_btc_amount) * 100;
    return Math.min(progress, 100);
  };

  const getScenarioIcon = (scenario: string) => {
    switch (scenario) {
      case 'bear': return '🐻';
      case 'conservative': return '📉';
      case 'stable': return '📊';
      case 'moderate': return '📈';
      case 'bull': return '🚀';
      default: return '⚙️';
    }
  };

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Savings Goals {maxGoals > 3 && goals.length > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">({goals.length})</span>}
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xs p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            title="Refresh"
            disabled={loading}
          >
            ↻
          </button>
          <a
            href="/goals"
            className="text-orange-600 hover:text-orange-700 text-xs font-medium"
          >
            View All →
          </a>
        </div>
      </div>

      <ThemedCard padding={false} className="flex-1 overflow-hidden">
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-pulse">
              <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ) : goals.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-3xl mb-2">🎯</div>
            <ThemedText variant="muted" className="text-sm mb-3">
              No active goals yet
            </ThemedText>
            <a
              href="/goals"
              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              Create your first goal →
            </a>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto max-h-full">
            {goals.slice(0, maxGoals).map((goal) => {
              const progress = calculateProgress(goal);
              const daysUntilTarget = Math.ceil(
                (new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );

              return (
                <div key={goal.id} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-1 mb-1">
                        <span className="text-sm">{getScenarioIcon(goal.price_scenario)}</span>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {goal.name}
                        </h4>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Target: {goal.target_btc_amount.toFixed(4)} ₿
                      </div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-0.5 rounded ${
                      progress >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      progress >= 50 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                    }`}>
                      {progress.toFixed(0)}%
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-2">
                    <div 
                      className={`h-1.5 rounded-full transition-all ${
                        progress >= 80 ? 'bg-green-500' :
                        progress >= 50 ? 'bg-blue-500' :
                        'bg-orange-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs">
                    <ThemedText variant="muted">
                      {goal.currency === 'EUR' ? '€' : '$'}{goal.monthly_fiat_needed.toLocaleString()}/mo
                    </ThemedText>
                    <ThemedText variant="muted">
                      {daysUntilTarget > 0 ? `${daysUntilTarget}d left` : 'Overdue'}
                    </ThemedText>
                  </div>
                </div>
              );
            })}
            {goals.length > maxGoals && (
              <div className="p-2 text-center">
                <a
                  href="/goals"
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                >
                  +{goals.length - maxGoals} more goals →
                </a>
              </div>
            )}
          </div>
        )}
      </ThemedCard>
    </div>
  );
}

